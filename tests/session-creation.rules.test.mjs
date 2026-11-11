import { after, before, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { collection, doc, getDoc, getDocs, setDoc, updateDoc } from "firebase/firestore";
import { closeSession, createSession, openSession } from "../src/utils/sessionReliability.js";

let env;
const groupId = "group";
const now = 1700000000000;

before(async () => {
  env = await initializeTestEnvironment({
    projectId: "demo-boardgame-night",
    firestore: { rules: readFileSync(new URL("../firestore.rules", import.meta.url), "utf8") },
  });
});
after(async () => { await env.cleanup(); });
beforeEach(async () => {
  await env.clearFirestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId), { ownerId: "owner" });
    for (const uid of ["owner", "member"]) {
      await setDoc(doc(db, "groups", groupId, "members", uid), { role: "member" });
    }
  });
});

it("atomically starts one session when members race, preserving server session index", async () => {
  const owner = env.authenticatedContext("owner").firestore();
  const member = env.authenticatedContext("member").firestore();
  await setDoc(doc(owner, "groups", groupId, "activeSession", "meta"), {
    ownerId: "owner", activeVoteId: null, status: null, sessionIndex: 7, extra: "kept",
  });

  const results = await Promise.allSettled([
    createSession(owner, groupId, "owner", now),
    createSession(member, groupId, "member", now),
  ]);
  assert.equal(results.filter((result) => result.status === "fulfilled").length, 1);
  assert.equal(results.filter((result) => result.status === "rejected").length, 1);
  const votes = await getDocs(collection(owner, "groups", groupId, "votes"));
  const meta = (await getDoc(doc(owner, "groups", groupId, "activeSession", "meta"))).data();
  assert.equal(votes.size, 1);
  assert.equal(meta.activeVoteId, votes.docs[0].id);
  assert.equal(meta.ownerId, votes.docs[0].data().createdBy);
  assert.equal(meta.sessionIndex, 7);
  assert.equal(meta.extra, "kept");
});

it("creates metadata if absent and rejects a denied transaction without an orphan vote", async () => {
  const owner = env.authenticatedContext("owner").firestore();
  await assert.rejects(createSession(owner, groupId, "someone-else", now));
  assert.equal((await getDocs(collection(owner, "groups", groupId, "votes"))).size, 0);
  assert.equal((await getDoc(doc(owner, "groups", groupId, "activeSession", "meta"))).exists(), false);
  const voteId = await createSession(owner, groupId, "owner", now);
  const meta = (await getDoc(doc(owner, "groups", groupId, "activeSession", "meta"))).data();
  assert.equal(meta.activeVoteId, voteId);
  assert.equal(meta.sessionIndex, 0);
});

async function seedOpenVote({ sessionIndex = 3 } = {}) {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "votes", "vote"), {
      status: "open", createdBy: "owner", createdAt: now, candidates: ["game"],
    });
    const meta = { ownerId: "owner", activeVoteId: "vote", status: "open", updatedAt: now };
    if (sessionIndex !== null) meta.sessionIndex = sessionIndex;
    await setDoc(doc(db, "groups", groupId, "activeSession", "meta"), meta);
    await setDoc(doc(db, "groups", groupId, "pool", "game"), {
      isActive: true, cycleVoteCount: 2, lifetimeVoteCount: 4, playedCount: 1,
    });
  });
}

function resultFor(uid, index) {
  return {
    winnerGameId: "game",
    scoreBreakdown: [{ gameId: "game", sessionVotes: 2, score: 2 }],
    weightsUsed: {},
    playRecord: {
      groupId, voteId: "vote", sessionIndex: index, playedAt: now,
      winnerGameId: "game", playedGameIds: ["game"], participantIds: ["owner", "member"],
      resultMode: "single", placements: [], createdAt: now, updatedAt: now, createdBy: uid,
    },
  };
}

it("serializes simultaneous closes and applies stats and session index exactly once", async () => {
  await seedOpenVote();
  const owner = env.authenticatedContext("owner").firestore();
  const member = env.authenticatedContext("member").firestore();
  let release;
  const bothRead = new Promise((resolve) => { release = resolve; });
  let ready = 0;
  const prepare = (uid) => async (index) => {
    if (++ready === 2) release();
    await bothRead;
    return resultFor(uid, index);
  };
  const results = await Promise.all([
    closeSession(owner, groupId, "vote", now, prepare("owner")),
    closeSession(member, groupId, "vote", now, prepare("member")),
  ]);
  assert.equal(results.filter(Boolean).length, 1);
  const pool = (await getDoc(doc(owner, "groups", groupId, "pool", "game"))).data();
  assert.equal(pool.cycleVoteCount, 4);
  assert.equal(pool.lifetimeVoteCount, 6);
  assert.equal(pool.playedCount, 2);
  assert.equal(pool.isActive, false);
  assert.equal(pool.lastWonSession, 3);
  const meta = (await getDoc(doc(owner, "groups", groupId, "activeSession", "meta"))).data();
  assert.equal(meta.sessionIndex, 4);
  assert.equal(meta.status, null);
  assert.equal(meta.activeVoteId, null);
  assert.equal((await getDoc(doc(owner, "groups", groupId, "votes", "vote"))).data().status, "closed");
  assert.equal((await getDoc(doc(owner, "groups", groupId, "plays", "vote"))).data().sessionIndex, 3);
});

it("rolls back all close writes when metadata rules reject and succeeds on retry", async () => {
  await seedOpenVote({ sessionIndex: "invalid" });
  const member = env.authenticatedContext("member").firestore();
  const owner = env.authenticatedContext("owner").firestore();
  await assert.rejects(closeSession(member, groupId, "vote", now, (index) => resultFor("member", index)));
  assert.equal((await getDoc(doc(member, "groups", groupId, "votes", "vote"))).data().status, "open");
  assert.equal((await getDoc(doc(member, "groups", groupId, "pool", "game"))).data().cycleVoteCount, 2);
  assert.equal((await getDoc(doc(member, "groups", groupId, "plays", "vote"))).exists(), false);
  assert.equal((await getDoc(doc(member, "groups", groupId, "activeSession", "meta"))).data().activeVoteId, "vote");

  await updateDoc(doc(owner, "groups", groupId, "activeSession", "meta"), { sessionIndex: 3 });
  assert.ok(await closeSession(member, groupId, "vote", now, (index) => resultFor("member", index)));
  assert.equal((await getDoc(doc(member, "groups", groupId, "pool", "game"))).data().cycleVoteCount, 4);
  assert.equal((await getDoc(doc(member, "groups", groupId, "activeSession", "meta"))).data().sessionIndex, 4);
  await createSession(member, groupId, "member", now + 1);
});

for (const missingValue of [undefined, null]) {
  it(`closes a legacy open vote with ${missingValue === undefined ? "missing" : "null"} session index as a member`, async () => {
    await seedOpenVote({ sessionIndex: null });
    if (missingValue === null) {
      await env.withSecurityRulesDisabled(async (context) => {
        await updateDoc(doc(context.firestore(), "groups", groupId, "activeSession", "meta"), { sessionIndex: null });
      });
    }
    const member = env.authenticatedContext("member").firestore();
    assert.ok(await closeSession(member, groupId, "vote", now, (index) => resultFor("member", index)));
    const meta = (await getDoc(doc(member, "groups", groupId, "activeSession", "meta"))).data();
    assert.equal(meta.sessionIndex, 1);
    assert.equal(meta.status, null);
    assert.equal((await getDoc(doc(member, "groups", groupId, "plays", "vote"))).data().sessionIndex, 0);
    await createSession(member, groupId, "member", now + 1);
  });
}

it("opens vote and matching metadata atomically as a member", async () => {
  await seedOpenVote();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await updateDoc(doc(db, "groups", groupId, "votes", "vote"), { status: "collecting" });
    await updateDoc(doc(db, "groups", groupId, "activeSession", "meta"), { status: "collecting" });
  });
  const member = env.authenticatedContext("member").firestore();
  assert.equal(await openSession(member, groupId, "vote", ["game"], now + 1), true);
  assert.equal((await getDoc(doc(member, "groups", groupId, "votes", "vote"))).data().status, "open");
  assert.equal((await getDoc(doc(member, "groups", groupId, "activeSession", "meta"))).data().status, "open");
  assert.ok(await closeSession(member, groupId, "vote", now + 2, (index) => resultFor("member", index)));
});

it("does not partially open when metadata is missing or points at a different vote", async () => {
  await seedOpenVote();
  const member = env.authenticatedContext("member").firestore();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await updateDoc(doc(db, "groups", groupId, "votes", "vote"), { status: "collecting" });
    await updateDoc(doc(db, "groups", groupId, "activeSession", "meta"), { status: "collecting", activeVoteId: "other" });
  });
  await assert.rejects(openSession(member, groupId, "vote", ["game"], now + 1), /SESSION_METADATA_MISMATCH/);
  assert.equal((await getDoc(doc(member, "groups", groupId, "votes", "vote"))).data().status, "collecting");
  assert.equal((await getDoc(doc(member, "groups", groupId, "activeSession", "meta"))).data().activeVoteId, "other");
});

it("rolls back the vote update if metadata authorization fails", async () => {
  await seedOpenVote();
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await updateDoc(doc(db, "groups", groupId, "votes", "vote"), { status: "collecting" });
    await updateDoc(doc(db, "groups", groupId, "activeSession", "meta"), { status: "collecting" });
  });
  const member = env.authenticatedContext("member").firestore();
  await assert.rejects(openSession(member, groupId, "vote", ["game"], "invalid"));
  assert.equal((await getDoc(doc(member, "groups", groupId, "votes", "vote"))).data().status, "collecting");
  assert.equal((await getDoc(doc(member, "groups", groupId, "activeSession", "meta"))).data().status, "collecting");
});

for (const staleStatus of ["open", "collecting"]) {
  it(`recovers legacy closed-vote metadata left ${staleStatus} before creating a session`, async () => {
    await seedOpenVote();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(doc(db, "groups", groupId, "votes", "vote"), { status: "closed" });
      await updateDoc(doc(db, "groups", groupId, "activeSession", "meta"), { status: staleStatus });
    });
    const member = env.authenticatedContext("member").firestore();
    const newVoteId = await createSession(member, groupId, "member", now + 1);
    const meta = (await getDoc(doc(member, "groups", groupId, "activeSession", "meta"))).data();
    assert.equal(meta.activeVoteId, newVoteId);
    assert.equal(meta.sessionIndex, 4);
    assert.equal(meta.status, "collecting");
  });
}

it("does not recover collecting metadata while its vote is still open", async () => {
  await seedOpenVote();
  await env.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "groups", groupId, "activeSession", "meta"), { status: "collecting" });
  });
  const member = env.authenticatedContext("member").firestore();
  await assert.rejects(createSession(member, groupId, "member", now + 1), /SESSION_ALREADY_ACTIVE/);
  await assert.rejects(updateDoc(doc(member, "groups", groupId, "activeSession", "meta"), {
    status: null, activeVoteId: null, sessionIndex: 4, updatedAt: now + 1,
  }));
  assert.equal((await getDocs(collection(member, "groups", groupId, "votes"))).size, 1);
});
