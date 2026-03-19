#!/usr/bin/env node

/**
 * One-time migration script: normalize legacy group play/session-history records.
 *
 * Targets docs: groups/{groupId}/plays/{playId}
 *
 * Usage:
 *   node scripts/migrate-legacy-plays.mjs --dry-run
 *   node scripts/migrate-legacy-plays.mjs --write
 *   node scripts/migrate-legacy-plays.mjs --dry-run --groupId=<groupId>
 *   node scripts/migrate-legacy-plays.mjs --write --groupId=<groupId> --playId=<playId>
 *
 * Auth:
 *   - Uses Application Default Credentials by default.
 *   - Optional: --serviceAccount=./path/to/service-account.json
 *   - Optional: --projectId=<firebase-project-id>
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { initializeApp, applicationDefault, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const RESULT_MODES = new Set(["ranked", "coop-win", "coop-loss", "no-winner"]);
const KNOWN_CREATOR_FIELDS = ["ownerId", "userId", "uid", "ownerUid", "sessionOwnerId"];

function parseArgs(argv) {
  const args = {
    dryRun: true,
    write: false,
    groupId: "",
    playId: "",
    serviceAccount: "",
    projectId: "",
  };

  for (const raw of argv) {
    const token = String(raw || "").trim();
    if (!token) continue;

    if (token === "--dry-run") {
      args.dryRun = true;
      args.write = false;
      continue;
    }

    if (token === "--write") {
      args.write = true;
      args.dryRun = false;
      continue;
    }

    if (token === "--help" || token === "-h") {
      printUsageAndExit(0);
    }

    const [key, ...rest] = token.split("=");
    const value = rest.join("=").trim();

    if (key === "--groupId") {
      args.groupId = value;
      continue;
    }

    if (key === "--playId") {
      args.playId = value;
      continue;
    }

    if (key === "--serviceAccount") {
      args.serviceAccount = value;
      continue;
    }

    if (key === "--projectId") {
      args.projectId = value;
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (args.playId && !args.groupId) {
    throw new Error("--playId requires --groupId for safe targeting.");
  }

  return args;
}

function printUsageAndExit(code) {
  console.log(`\nUsage:
  node scripts/migrate-legacy-plays.mjs --dry-run
  node scripts/migrate-legacy-plays.mjs --write
  node scripts/migrate-legacy-plays.mjs --dry-run --groupId=<groupId>
  node scripts/migrate-legacy-plays.mjs --write --groupId=<groupId> --playId=<playId>

Options:
  --dry-run                  Preview changes (default)
  --write                    Apply updates
  --groupId=<groupId>        Restrict scan to one group
  --playId=<playId>          Restrict scan to one play (requires --groupId)
  --serviceAccount=<path>    Service account JSON file path
  --projectId=<projectId>    Firebase project id override
  --help, -h                 Show this help
`);
  process.exit(code);
}

function isNonEmptyString(value) {
  return typeof value === "string" && value.trim().length > 0;
}

function cleanString(value) {
  return isNonEmptyString(value) ? value.trim() : "";
}

function toFiniteNumber(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (typeof value === "string" && value.trim()) {
    const numeric = Number(value);
    if (Number.isFinite(numeric)) return numeric;
  }
  return null;
}

function toOptionalTimestamp(value) {
  const numeric = toFiniteNumber(value);
  if (numeric == null) return null;
  return Math.floor(numeric);
}

function toOptionalSessionIndex(value) {
  const numeric = toFiniteNumber(value);
  if (numeric == null) return null;
  return Math.floor(numeric);
}

function defaultResultMode(winnerGameId) {
  return winnerGameId ? "ranked" : "no-winner";
}

function normalizeResultMode(value, fallbackMode) {
  return RESULT_MODES.has(value) ? value : fallbackMode;
}

function normalizePlayedGameIds(playedGameIds, winnerGameId) {
  const winnerId = cleanString(winnerGameId) || null;
  const uniqueIds = [];

  for (const value of Array.isArray(playedGameIds) ? playedGameIds : []) {
    const gameId = cleanString(String(value ?? ""));
    if (!gameId || uniqueIds.includes(gameId)) continue;
    uniqueIds.push(gameId);
  }

  if (!winnerId) return uniqueIds;
  return [winnerId, ...uniqueIds.filter((id) => id !== winnerId)];
}

function normalizePlacements(placements, resultMode) {
  const mode = normalizeResultMode(resultMode, "no-winner");

  if (mode === "coop-loss" || mode === "no-winner") {
    return [];
  }

  const dedupedByUser = new Map();

  for (const entry of Array.isArray(placements) ? placements : []) {
    const userId = cleanString(entry?.userId);
    if (!userId) continue;

    const placeValue = toFiniteNumber(entry?.place);
    if (placeValue == null || placeValue < 1) continue;

    dedupedByUser.set(userId, {
      userId,
      place: mode === "coop-win" ? 1 : Math.floor(placeValue),
    });
  }

  return [...dedupedByUser.values()].sort((a, b) => {
    if (a.place !== b.place) return a.place - b.place;
    return a.userId.localeCompare(b.userId);
  });
}

function normalizeParticipantIds(participantIds, fallbackIds = []) {
  const uniqueIds = [];

  for (const value of Array.isArray(participantIds) ? participantIds : []) {
    const userId = cleanString(value);
    if (!userId || uniqueIds.includes(userId)) continue;
    uniqueIds.push(userId);
  }

  if (uniqueIds.length > 0) return uniqueIds;

  const fallbackUnique = [];
  for (const value of Array.isArray(fallbackIds) ? fallbackIds : []) {
    const userId = cleanString(value);
    if (!userId || fallbackUnique.includes(userId)) continue;
    fallbackUnique.push(userId);
  }

  return fallbackUnique;
}

function resolveWinnerGameId(data) {
  const canonicalWinnerId = cleanString(data?.winnerGameId);
  if (canonicalWinnerId) return canonicalWinnerId;

  const legacyWinnerId = cleanString(data?.gameId);
  if (legacyWinnerId) return legacyWinnerId;

  return null;
}

function hasLegacyPlacementData(rawPlacements) {
  return Array.isArray(rawPlacements) && rawPlacements.length > 0;
}

function inferFallbackResultMode({ rawResultMode, winnerGameId, rawPlacements }) {
  if (RESULT_MODES.has(rawResultMode)) return rawResultMode;

  if (hasLegacyPlacementData(rawPlacements)) {
    return "ranked";
  }

  const rankedLikePlacements = normalizePlacements(rawPlacements, "ranked");
  if (rankedLikePlacements.length > 0) {
    const allFirstPlace = rankedLikePlacements.every((entry) => entry.place === 1);
    if (allFirstPlace && !winnerGameId) {
      return "coop-win";
    }
    return "ranked";
  }

  if (winnerGameId) return "ranked";
  return "no-winner";
}

function deepEqual(a, b) {
  return JSON.stringify(a) === JSON.stringify(b);
}

function pickCreatedBy(data, groupOwnerId) {
  const direct = cleanString(data?.createdBy);
  if (direct) {
    return { value: direct, source: "createdBy" };
  }

  for (const key of KNOWN_CREATOR_FIELDS) {
    const candidate = cleanString(data?.[key]);
    if (candidate) {
      return { value: candidate, source: key };
    }
  }

  if (isNonEmptyString(groupOwnerId)) {
    return { value: cleanString(groupOwnerId), source: "groupOwnerId" };
  }

  return { value: "__legacy_unknown__", source: "sentinel" };
}

function computeNormalization({ groupIdFromPath, playId, data, now, groupOwnerId }) {
  const reasons = [];
  const manualReviewNotes = [];
  const patch = {};

  const normalizedGroupId = groupIdFromPath;
  if (data?.groupId !== normalizedGroupId) {
    patch.groupId = normalizedGroupId;
    reasons.push("groupId");
  }

  const normalizedVoteId = cleanString(data?.voteId) || playId;
  if (!cleanString(data?.voteId)) reasons.push("voteId");
  if (data?.voteId !== normalizedVoteId) {
    patch.voteId = normalizedVoteId;
  }

  const normalizedSessionIndex = toOptionalSessionIndex(data?.sessionIndex);
  if (!deepEqual(data?.sessionIndex ?? null, normalizedSessionIndex)) {
    patch.sessionIndex = normalizedSessionIndex;
    reasons.push("sessionIndex");
  }

  const normalizedPlayedAt = toOptionalTimestamp(data?.playedAt);
  if (!deepEqual(data?.playedAt ?? null, normalizedPlayedAt)) {
    patch.playedAt = normalizedPlayedAt;
    reasons.push("playedAt");
  }

  const normalizedWinnerGameId = resolveWinnerGameId(data);
  if (!deepEqual(data?.winnerGameId ?? null, normalizedWinnerGameId)) {
    patch.winnerGameId = normalizedWinnerGameId;
    reasons.push("winnerGameId");
  }

  const normalizedPlayedGameIds = normalizePlayedGameIds(
    data?.playedGameIds,
    normalizedWinnerGameId
  );
  if (!deepEqual(data?.playedGameIds ?? [], normalizedPlayedGameIds)) {
    patch.playedGameIds = normalizedPlayedGameIds;
    reasons.push("playedGameIds");
  }

  const fallbackResultMode = inferFallbackResultMode({
    rawResultMode: data?.resultMode,
    winnerGameId: normalizedWinnerGameId,
    rawPlacements: data?.placements,
  });
  const normalizedResultMode = normalizeResultMode(data?.resultMode, fallbackResultMode);
  if (!deepEqual(data?.resultMode ?? null, normalizedResultMode)) {
    patch.resultMode = normalizedResultMode;
    reasons.push("resultMode");
  }

  const normalizedPlacements = normalizePlacements(data?.placements, normalizedResultMode);
  if (!deepEqual(data?.placements ?? [], normalizedPlacements)) {
    patch.placements = normalizedPlacements;
    reasons.push("placements");
  }

  const participantIdsFromPlacements = normalizedPlacements.map((entry) => entry.userId);
  const normalizedParticipantIds = normalizeParticipantIds(
    data?.participantIds,
    participantIdsFromPlacements
  );
  if (!deepEqual(data?.participantIds ?? [], normalizedParticipantIds)) {
    patch.participantIds = normalizedParticipantIds;
    reasons.push("participantIds");
  }

  const currentCreatedAt = toOptionalTimestamp(data?.createdAt);
  const currentUpdatedAt = toOptionalTimestamp(data?.updatedAt);
  const createdAtFallback =
    normalizedPlayedAt ??
    currentUpdatedAt ??
    now;
  const normalizedCreatedAt = currentCreatedAt ?? createdAtFallback;
  if (!deepEqual(data?.createdAt ?? null, normalizedCreatedAt)) {
    patch.createdAt = normalizedCreatedAt;
    reasons.push("createdAt");
  }

  const normalizedUpdatedAt = currentUpdatedAt ?? normalizedCreatedAt;
  if (!deepEqual(data?.updatedAt ?? null, normalizedUpdatedAt)) {
    patch.updatedAt = normalizedUpdatedAt;
    reasons.push("updatedAt");
  }

  const createdBy = pickCreatedBy(data, groupOwnerId);
  if (!deepEqual(data?.createdBy ?? "", createdBy.value)) {
    patch.createdBy = createdBy.value;
    reasons.push("createdBy");
  }

  if (createdBy.source === "sentinel") {
    manualReviewNotes.push("createdBy unresolved; used sentinel '__legacy_unknown__'.");
  }

  return {
    patch,
    reasons,
    manualReviewNotes,
  };
}

function logRecordPlan({ pathText, reasons, patch, manualReviewNotes, dryRun }) {
  const mode = dryRun ? "DRY" : "WRITE";
  console.log(`\n[${mode}] ${pathText}`);
  console.log(`  fields: ${reasons.join(", ")}`);
  console.log(`  patch: ${JSON.stringify(patch)}`);
  if (manualReviewNotes.length > 0) {
    console.log(`  manual-review: ${manualReviewNotes.join(" | ")}`);
  }
}

function initializeFirebaseAdmin({ serviceAccountPath, projectId }) {
  const hasExistingApp = getApps().length > 0;
  if (hasExistingApp) return getFirestore();

  let credential;

  if (serviceAccountPath) {
    const absolutePath = path.resolve(process.cwd(), serviceAccountPath);
    const raw = fs.readFileSync(absolutePath, "utf8");
    const json = JSON.parse(raw);
    credential = cert(json);
  } else {
    credential = applicationDefault();
  }

  initializeApp({
    credential,
    ...(projectId ? { projectId } : {}),
  });

  return getFirestore();
}

async function loadTargetPlayDocs(db, { groupId, playId }) {
  if (groupId) {
    if (playId) {
      const ref = db.collection("groups").doc(groupId).collection("plays").doc(playId);
      const snap = await ref.get();
      return snap.exists ? [snap] : [];
    }

    const snap = await db.collection("groups").doc(groupId).collection("plays").get();
    return snap.docs;
  }

  const snap = await db.collectionGroup("plays").get();
  return snap.docs;
}

function inferGroupIdFromRef(docRef) {
  return docRef?.parent?.parent?.id || "";
}

async function main() {
  const args = parseArgs(process.argv.slice(2));

  console.log("\n=== Legacy Plays Migration ===");
  console.log(`mode: ${args.dryRun ? "dry-run" : "write"}`);
  console.log(`groupId: ${args.groupId || "(all)"}`);
  console.log(`playId: ${args.playId || "(all)"}`);

  const db = initializeFirebaseAdmin({
    serviceAccountPath: args.serviceAccount,
    projectId: args.projectId,
  });

  const playDocs = await loadTargetPlayDocs(db, {
    groupId: args.groupId,
    playId: args.playId,
  });

  const ownerCache = new Map();
  async function getGroupOwnerId(groupId) {
    if (ownerCache.has(groupId)) return ownerCache.get(groupId);
    if (!groupId) {
      ownerCache.set(groupId, null);
      return null;
    }

    const snap = await db.collection("groups").doc(groupId).get();
    const ownerId = cleanString(snap.data()?.ownerId) || null;
    ownerCache.set(groupId, ownerId);
    return ownerId;
  }

  let scanned = 0;
  let needsMigration = 0;
  let updated = 0;
  let skipped = 0;
  let manualReview = 0;
  let errors = 0;

  const migrationNow = Date.now();

  for (const docSnap of playDocs) {
    scanned += 1;
    const groupId = inferGroupIdFromRef(docSnap.ref);
    const playId = docSnap.id;
    const data = docSnap.data() || {};
    const groupOwnerId = await getGroupOwnerId(groupId);

    const { patch, reasons, manualReviewNotes } = computeNormalization({
      groupIdFromPath: groupId,
      playId,
      data,
      now: migrationNow,
      groupOwnerId,
    });

    const hasChanges = Object.keys(patch).length > 0;
    if (!hasChanges) {
      skipped += 1;
      continue;
    }

    needsMigration += 1;
    if (manualReviewNotes.length > 0) {
      manualReview += 1;
    }

    const pathText = `groups/${groupId}/plays/${playId}`;
    logRecordPlan({
      pathText,
      reasons,
      patch,
      manualReviewNotes,
      dryRun: args.dryRun,
    });

    if (args.dryRun) {
      continue;
    }

    try {
      await docSnap.ref.update(patch);
      updated += 1;
    } catch (error) {
      errors += 1;
      console.error(`  ERROR updating ${pathText}:`, error?.message || error);
    }
  }

  console.log("\n=== Migration Summary ===");
  console.log(`scanned: ${scanned}`);
  console.log(`needsMigration: ${needsMigration}`);
  console.log(`updated: ${updated}`);
  console.log(`skipped: ${skipped}`);
  console.log(`manualReview: ${manualReview}`);
  console.log(`errors: ${errors}`);

  if (!args.dryRun && errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Migration failed:", error?.message || error);
  process.exit(1);
});
