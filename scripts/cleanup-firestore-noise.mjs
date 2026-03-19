#!/usr/bin/env node

/**
 * One-time Firestore cleanup script for test/noise data.
 *
 * Safety defaults:
 * - Dry-run by default
 * - Explicit --write required for deletes
 * - Hard keep-list protection for known real group/users
 * - Never touches /games
 *
 * Usage:
 *   node scripts/cleanup-firestore-noise.mjs --dry-run --projectId=<id> --serviceAccount=<path>
 *   node scripts/cleanup-firestore-noise.mjs --write --projectId=<id> --serviceAccount=<path>
 *   node scripts/cleanup-firestore-noise.mjs --dry-run --groups-only --projectId=<id> --serviceAccount=<path>
 *   node scripts/cleanup-firestore-noise.mjs --dry-run --users-only --projectId=<id> --serviceAccount=<path>
 */

import fs from "node:fs";
import path from "node:path";
import process from "node:process";
import { initializeApp, applicationDefault, cert, getApps } from "firebase-admin/app";
import { getFirestore } from "firebase-admin/firestore";

const DEFAULT_KEEP_GROUPS = new Set(["MmtdxUjmdNxt2SyWEfFq"]);
const DEFAULT_KEEP_USERS = new Set([
  "3KhZesqsMtOpxtlbGHrg1bgryKu2",
  "FVEfZJ2uMTdOJW0PgwmM99f9yh72",
  "aC62GVNxgQfetFzznamaJNCB1hx2",
  "xC7YEHvSrPY3gprsR4NRak1li672",
]);

function parseCsvSet(value) {
  const set = new Set();
  for (const item of String(value || "").split(",")) {
    const id = item.trim();
    if (id) set.add(id);
  }
  return set;
}

function parseArgs(argv) {
  const args = {
    dryRun: true,
    write: false,
    groupsOnly: false,
    usersOnly: false,
    projectId: "",
    serviceAccount: "",
    keepGroups: new Set(DEFAULT_KEEP_GROUPS),
    keepUsers: new Set(DEFAULT_KEEP_USERS),
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

    if (token === "--groups-only") {
      args.groupsOnly = true;
      continue;
    }

    if (token === "--users-only") {
      args.usersOnly = true;
      continue;
    }

    if (token === "--help" || token === "-h") {
      printUsageAndExit(0);
    }

    const [key, ...rest] = token.split("=");
    const value = rest.join("=").trim();

    if (key === "--projectId") {
      args.projectId = value;
      continue;
    }

    if (key === "--serviceAccount") {
      args.serviceAccount = value;
      continue;
    }

    if (key === "--keepGroup") {
      args.keepGroups = parseCsvSet(value);
      continue;
    }

    if (key === "--keepUser") {
      args.keepUsers = parseCsvSet(value);
      continue;
    }

    throw new Error(`Unknown argument: ${token}`);
  }

  if (args.groupsOnly && args.usersOnly) {
    throw new Error("Use only one of --groups-only or --users-only.");
  }

  if (!args.keepGroups.size) {
    throw new Error("At least one keep-group is required.");
  }

  if (!args.keepUsers.size) {
    throw new Error("At least one keep-user is required.");
  }

  return args;
}

function printUsageAndExit(code) {
  console.log(`\nUsage:
  node scripts/cleanup-firestore-noise.mjs --dry-run --projectId=<id> --serviceAccount=<path>
  node scripts/cleanup-firestore-noise.mjs --write --projectId=<id> --serviceAccount=<path>
  node scripts/cleanup-firestore-noise.mjs --dry-run --groups-only --projectId=<id> --serviceAccount=<path>
  node scripts/cleanup-firestore-noise.mjs --dry-run --users-only --projectId=<id> --serviceAccount=<path>

Options:
  --dry-run                  Preview only (default)
  --write                    Apply deletes
  --groups-only              Cleanup groups scope only
  --users-only               Cleanup users scope only
  --projectId=<id>           Firebase project id
  --serviceAccount=<path>    Service account JSON path
  --keepGroup=<ids>          Comma-separated keep-group IDs (optional override)
  --keepUser=<ids>           Comma-separated keep-user IDs (optional override)
  --help, -h                 Show help
`);
  process.exit(code);
}

function cleanString(value) {
  return typeof value === "string" && value.trim() ? value.trim() : "";
}

function arrayOfStrings(value) {
  if (!Array.isArray(value)) return [];
  const out = [];
  for (const item of value) {
    const id = cleanString(item);
    if (!id || out.includes(id)) continue;
    out.push(id);
  }
  return out;
}

function initializeFirebaseAdmin({ serviceAccountPath, projectId }) {
  if (getApps().length > 0) return getFirestore();

  let credential;
  if (serviceAccountPath) {
    const absolutePath = path.resolve(process.cwd(), serviceAccountPath);
    const raw = fs.readFileSync(absolutePath, "utf8");
    credential = cert(JSON.parse(raw));
  } else {
    credential = applicationDefault();
  }

  initializeApp({
    credential,
    ...(projectId ? { projectId } : {}),
  });

  return getFirestore();
}

async function scanDocumentTree(docRef) {
  const result = {
    totalDescendantDocs: 0,
    byCollectionPath: new Map(),
  };

  async function walkDoc(ref) {
    const subcollections = await ref.listCollections();
    for (const subcollection of subcollections) {
      const snap = await subcollection.get();
      for (const subDoc of snap.docs) {
        result.totalDescendantDocs += 1;
        const key = subcollection.path;
        result.byCollectionPath.set(key, (result.byCollectionPath.get(key) || 0) + 1);
        await walkDoc(subDoc.ref);
      }
    }
  }

  await walkDoc(docRef);
  return result;
}

async function deleteDocumentTree(docRef, counters) {
  async function walkDelete(ref) {
    const subcollections = await ref.listCollections();
    for (const subcollection of subcollections) {
      const snap = await subcollection.get();
      for (const subDoc of snap.docs) {
        await walkDelete(subDoc.ref);
      }
    }
    await ref.delete();
    counters.deletedDocCount += 1;
  }

  await walkDelete(docRef);
}

function collectUserReferencesFromObject(value, outSet) {
  const ownerId = cleanString(value?.ownerId);
  if (ownerId) outSet.add(ownerId);

  const createdBy = cleanString(value?.createdBy);
  if (createdBy) outSet.add(createdBy);

  for (const id of arrayOfStrings(value?.participantIds)) outSet.add(id);

  for (const placement of Array.isArray(value?.placements) ? value.placements : []) {
    const uid = cleanString(placement?.userId);
    if (uid) outSet.add(uid);
  }
}

async function collectPreservedGroupUserReferences(db, keepGroupId) {
  const refs = new Set();

  const groupRef = db.collection("groups").doc(keepGroupId);
  const groupSnap = await groupRef.get();
  if (groupSnap.exists) {
    collectUserReferencesFromObject(groupSnap.data() || {}, refs);
  }

  const membersSnap = await groupRef.collection("members").get();
  for (const docSnap of membersSnap.docs) {
    refs.add(docSnap.id);
    collectUserReferencesFromObject(docSnap.data() || {}, refs);
  }

  const gamesSnap = await groupRef.collection("games").get();
  for (const gameDoc of gamesSnap.docs) {
    collectUserReferencesFromObject(gameDoc.data() || {}, refs);
    const ownersSnap = await gameDoc.ref.collection("owners").get();
    for (const ownerDoc of ownersSnap.docs) {
      refs.add(ownerDoc.id);
      collectUserReferencesFromObject(ownerDoc.data() || {}, refs);
    }
  }

  const playsSnap = await groupRef.collection("plays").get();
  for (const playDoc of playsSnap.docs) {
    collectUserReferencesFromObject(playDoc.data() || {}, refs);
  }

  const votesSnap = await groupRef.collection("votes").get();
  for (const voteDoc of votesSnap.docs) {
    collectUserReferencesFromObject(voteDoc.data() || {}, refs);

    const submissionsSnap = await voteDoc.ref.collection("submissions").get();
    for (const subDoc of submissionsSnap.docs) {
      refs.add(subDoc.id);
      collectUserReferencesFromObject(subDoc.data() || {}, refs);
    }

    const ballotsSnap = await voteDoc.ref.collection("ballots").get();
    for (const ballotDoc of ballotsSnap.docs) {
      refs.add(ballotDoc.id);
      collectUserReferencesFromObject(ballotDoc.data() || {}, refs);
    }
  }

  const activeSessionSnap = await groupRef.collection("activeSession").get();
  for (const sessionDoc of activeSessionSnap.docs) {
    collectUserReferencesFromObject(sessionDoc.data() || {}, refs);
  }

  const settingsSnap = await groupRef.collection("settings").get();
  for (const settingDoc of settingsSnap.docs) {
    collectUserReferencesFromObject(settingDoc.data() || {}, refs);
  }

  return refs;
}

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const cleanupGroups = !args.usersOnly;
  const cleanupUsers = !args.groupsOnly;

  console.log("\n=== Firestore Noise Cleanup ===");
  console.log(`mode: ${args.dryRun ? "dry-run" : "write"}`);
  console.log(`scope: ${cleanupGroups && cleanupUsers ? "groups + users" : cleanupGroups ? "groups only" : "users only"}`);
  console.log(`keepGroups: ${[...args.keepGroups].join(", ")}`);
  console.log(`keepUsers: ${[...args.keepUsers].join(", ")}`);

  const db = initializeFirebaseAdmin({
    serviceAccountPath: args.serviceAccount,
    projectId: args.projectId,
  });

  const counters = {
    groupsScanned: 0,
    groupsPlannedDelete: 0,
    groupsDeleted: 0,
    usersScanned: 0,
    usersPlannedDelete: 0,
    usersDeleted: 0,
    usersSkippedProtected: 0,
    usersSkippedReferencedByKeepScope: 0,
    ratingsDeleted: 0,
    userDirectoryDeleted: 0,
    deletedDocCount: 0,
    manualReviewUsers: 0,
    errors: 0,
  };

  const groupsToDelete = [];

  if (cleanupGroups) {
    const groupsSnap = await db.collection("groups").get();
    counters.groupsScanned = groupsSnap.size;

    for (const docSnap of groupsSnap.docs) {
      if (args.keepGroups.has(docSnap.id)) continue;
      groupsToDelete.push(docSnap);
    }

    counters.groupsPlannedDelete = groupsToDelete.length;

    console.log("\n--- Groups Planned For Deletion ---");
    if (!groupsToDelete.length) {
      console.log("(none)");
    }

    for (const groupDoc of groupsToDelete) {
      const stats = await scanDocumentTree(groupDoc.ref);
      console.log(`group ${groupDoc.id}: descendantDocs=${stats.totalDescendantDocs}`);
      for (const [collectionPath, count] of [...stats.byCollectionPath.entries()].sort((a, b) => a[0].localeCompare(b[0]))) {
        console.log(`  - ${collectionPath}: ${count}`);
      }

      if (args.dryRun) continue;

      try {
        await deleteDocumentTree(groupDoc.ref, counters);
        counters.groupsDeleted += 1;
      } catch (error) {
        counters.errors += 1;
        console.error(`ERROR deleting group ${groupDoc.id}:`, error?.message || error);
      }
    }
  }

  if (cleanupUsers) {
    const keepScopeReferences = new Set();
    for (const keepGroupId of args.keepGroups) {
      const refs = await collectPreservedGroupUserReferences(db, keepGroupId);
      for (const uid of refs) {
        keepScopeReferences.add(uid);
      }
    }

    const usersSnap = await db.collection("users").get();
    const directorySnap = await db.collection("userDirectory").get();

    const userIds = new Set();
    for (const docSnap of usersSnap.docs) userIds.add(docSnap.id);
    for (const docSnap of directorySnap.docs) userIds.add(docSnap.id);

    counters.usersScanned = userIds.size;

    const usersToDelete = [];
    const usersForManualReview = [];

    for (const uid of [...userIds].sort()) {
      if (args.keepUsers.has(uid)) {
        counters.usersSkippedProtected += 1;
        continue;
      }

      if (keepScopeReferences.has(uid)) {
        counters.usersSkippedReferencedByKeepScope += 1;
        counters.manualReviewUsers += 1;
        usersForManualReview.push(uid);
        continue;
      }

      usersToDelete.push(uid);
    }

    counters.usersPlannedDelete = usersToDelete.length;

    console.log("\n--- Users Skipped (Manual Review: referenced by kept group scope) ---");
    if (!usersForManualReview.length) {
      console.log("(none)");
    } else {
      for (const uid of usersForManualReview) {
        console.log(`- ${uid}`);
      }
    }

    console.log("\n--- Users Planned For Deletion ---");
    if (!usersToDelete.length) {
      console.log("(none)");
    }

    for (const uid of usersToDelete) {
      const userRef = db.collection("users").doc(uid);
      const directoryRef = db.collection("userDirectory").doc(uid);
      const [userSnap, directoryDoc, ratingsSnap] = await Promise.all([
        userRef.get(),
        directoryRef.get(),
        db.collection("ratings").where("userId", "==", uid).get(),
      ]);

      let userDescendantDocs = 0;
      if (userSnap.exists) {
        const stats = await scanDocumentTree(userRef);
        userDescendantDocs = stats.totalDescendantDocs;
      }

      console.log(`user ${uid}: userDoc=${userSnap.exists ? "yes" : "no"}, userDescendants=${userDescendantDocs}, directoryDoc=${directoryDoc.exists ? "yes" : "no"}, ratings=${ratingsSnap.size}`);

      if (args.dryRun) continue;

      try {
        if (userSnap.exists) {
          await deleteDocumentTree(userRef, counters);
        }

        if (directoryDoc.exists) {
          await directoryRef.delete();
          counters.deletedDocCount += 1;
          counters.userDirectoryDeleted += 1;
        }

        for (const ratingDoc of ratingsSnap.docs) {
          await ratingDoc.ref.delete();
          counters.deletedDocCount += 1;
          counters.ratingsDeleted += 1;
        }

        counters.usersDeleted += 1;
      } catch (error) {
        counters.errors += 1;
        console.error(`ERROR deleting user ${uid}:`, error?.message || error);
      }
    }
  }

  console.log("\n=== Cleanup Summary ===");
  console.log(`groupsScanned: ${counters.groupsScanned}`);
  console.log(`groupsPlannedDelete: ${counters.groupsPlannedDelete}`);
  console.log(`groupsDeleted: ${counters.groupsDeleted}`);
  console.log(`usersScanned: ${counters.usersScanned}`);
  console.log(`usersPlannedDelete: ${counters.usersPlannedDelete}`);
  console.log(`usersDeleted: ${counters.usersDeleted}`);
  console.log(`usersSkippedProtected: ${counters.usersSkippedProtected}`);
  console.log(`usersSkippedReferencedByKeepScope: ${counters.usersSkippedReferencedByKeepScope}`);
  console.log(`manualReviewUsers: ${counters.manualReviewUsers}`);
  console.log(`userDirectoryDeleted: ${counters.userDirectoryDeleted}`);
  console.log(`ratingsDeleted: ${counters.ratingsDeleted}`);
  console.log(`deletedDocCount: ${counters.deletedDocCount}`);
  console.log(`errors: ${counters.errors}`);

  if (!args.dryRun && counters.errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Cleanup failed:", error?.message || error);
  process.exit(1);
});
