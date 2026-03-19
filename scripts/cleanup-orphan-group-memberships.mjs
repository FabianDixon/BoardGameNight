#!/usr/bin/env node

/**
 * Cleanup orphan user-group index docs that point to deleted groups.
 *
 * Scope:
 * - users/{uid}/groups/{groupId} where groups/{groupId} does not exist
 * - restricted by keep-user and keep-group allow-lists (conservative)
 *
 * Usage:
 *   node scripts/cleanup-orphan-group-memberships.mjs --dry-run --projectId=<id> --serviceAccount=<path>
 *   node scripts/cleanup-orphan-group-memberships.mjs --write --projectId=<id> --serviceAccount=<path>
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

  if (!args.keepGroups.size) throw new Error("At least one keep-group is required.");
  if (!args.keepUsers.size) throw new Error("At least one keep-user is required.");

  return args;
}

function printUsageAndExit(code) {
  console.log(`\nUsage:
  node scripts/cleanup-orphan-group-memberships.mjs --dry-run --projectId=<id> --serviceAccount=<path>
  node scripts/cleanup-orphan-group-memberships.mjs --write --projectId=<id> --serviceAccount=<path>

Options:
  --dry-run                  Preview only (default)
  --write                    Apply deletes
  --projectId=<id>           Firebase project id
  --serviceAccount=<path>    Service account JSON path
  --keepGroup=<ids>          Comma-separated keep-group IDs (optional override)
  --keepUser=<ids>           Comma-separated keep-user IDs (optional override)
  --help, -h                 Show help
`);
  process.exit(code);
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

async function main() {
  const args = parseArgs(process.argv.slice(2));
  const db = initializeFirebaseAdmin({
    serviceAccountPath: args.serviceAccount,
    projectId: args.projectId,
  });

  const counters = {
    usersScanned: 0,
    userGroupRefsScanned: 0,
    orphanRefsFound: 0,
    orphanRefsDeleted: 0,
    keptRefsSkipped: 0,
    errors: 0,
  };

  console.log("\n=== Orphan User Group Reference Cleanup ===");
  console.log(`mode: ${args.dryRun ? "dry-run" : "write"}`);
  console.log(`keepGroups: ${[...args.keepGroups].join(", ")}`);
  console.log(`keepUsers: ${[...args.keepUsers].join(", ")}`);

  for (const uid of [...args.keepUsers].sort()) {
    counters.usersScanned += 1;

    const userGroupsRef = db.collection("users").doc(uid).collection("groups");
    const userGroupsSnap = await userGroupsRef.get();

    console.log(`\nuser ${uid}: refs=${userGroupsSnap.size}`);

    for (const membershipDoc of userGroupsSnap.docs) {
      counters.userGroupRefsScanned += 1;

      const groupId = String(membershipDoc.id || "").trim();
      if (!groupId) continue;

      if (args.keepGroups.has(groupId)) {
        counters.keptRefsSkipped += 1;
        console.log(`  - keep ${groupId}`);
        continue;
      }

      const groupSnap = await db.collection("groups").doc(groupId).get();
      if (groupSnap.exists) {
        console.log(`  - ok   ${groupId}`);
        continue;
      }

      counters.orphanRefsFound += 1;
      console.log(`  - orphan ${groupId}${args.dryRun ? " (planned delete)" : " (deleting)"}`);

      if (args.dryRun) continue;

      try {
        await membershipDoc.ref.delete();
        counters.orphanRefsDeleted += 1;
      } catch (error) {
        counters.errors += 1;
        console.error(`    ERROR deleting users/${uid}/groups/${groupId}:`, error?.message || error);
      }
    }
  }

  console.log("\n=== Summary ===");
  console.log(`usersScanned: ${counters.usersScanned}`);
  console.log(`userGroupRefsScanned: ${counters.userGroupRefsScanned}`);
  console.log(`orphanRefsFound: ${counters.orphanRefsFound}`);
  console.log(`orphanRefsDeleted: ${counters.orphanRefsDeleted}`);
  console.log(`keptRefsSkipped: ${counters.keptRefsSkipped}`);
  console.log(`errors: ${counters.errors}`);

  if (!args.dryRun && counters.errors > 0) {
    process.exitCode = 1;
  }
}

main().catch((error) => {
  console.error("Cleanup failed:", error?.message || error);
  process.exit(1);
});
