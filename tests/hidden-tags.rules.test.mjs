import { after, before, beforeEach, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { assertFails, assertSucceeds, initializeTestEnvironment } from "@firebase/rules-unit-testing";
import { doc, getDoc, setDoc, updateDoc, writeBatch } from "firebase/firestore";
import { resolveEffectiveWinnerId, saveSessionOverride } from "../src/utils/sessionReliability.js";

let env;
const groupId = "group";
const voteId = "vote";
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
    await setDoc(doc(db, "groups", groupId, "members", "member"), { role: "member" });
    await setDoc(doc(db, "groups", groupId, "settings", "meta"), { hiddenTags: ["party"] });
    await setDoc(doc(db, "groups", groupId, "activeSession", "meta"), { status: "collecting", ownerId: "owner", sessionIndex: 1 });
    await setDoc(doc(db, "groups", groupId, "votes", voteId), { status: "collecting", createdBy: "owner" });
    await setDoc(doc(db, "games", "hidden"), { title: "H", tags: ["party", "x"] });
    await setDoc(doc(db, "games", "plain"), { title: "P", tags: ["coop"] });
    await setDoc(doc(db, "games", "notags"), { title: "N" });
    await setDoc(doc(db, "games", "hiddenOld"), { title: "O", tags: ["party"] });
    await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), { isActive: false, lifetimeVoteCount: 3 });
  });
});

const submission = (db, gameId) =>
  setDoc(doc(db, "groups", groupId, "votes", voteId, "submissions", "member"), { gameId, submittedAt: now });
const activate = (db, gameId) =>
  setDoc(doc(db, "groups", groupId, "pool", gameId), {
    isActive: true, addedAt: now, cycleStartedAt: now, cycleVoteCount: 0, cycleStartedSession: 1,
  }, { merge: true });

it("denies submissions and pool activation for hidden-tag games, allows others", async () => {
  const db = env.authenticatedContext("member").firestore();
  await assertFails(submission(db, "hidden"));
  await assertFails(activate(db, "hidden"));
  await assertFails(activate(db, "hiddenOld"));
  await assertFails(submission(db, "missing"));
  await assertSucceeds(submission(db, "plain"));
  await assertSucceeds(submission(db, "notags"));
  await assertSucceeds(activate(db, "plain"));
});

it("still allows no-submission records and unrestricted games without settings", async () => {
  const db = env.authenticatedContext("member").firestore();
  await assertSucceeds(setDoc(doc(db, "groups", groupId, "votes", voteId, "submissions", "member"), { isNoSubmission: true, submittedAt: now }));
  await env.withSecurityRulesDisabled(async (c) => {
    await setDoc(doc(c.firestore(), "groups", groupId, "settings", "meta"), { hiddenTags: [] });
  });
  await assertSucceeds(submission(db, "hidden"));
});

it("lets owners restore a hidden/missing previous winner, but nobody else or never-won games", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), { isActive: false, lastWonSession: 2 });
    await setDoc(doc(db, "groups", groupId, "pool", "gone"), { isActive: false, lastWonSession: 1 });
    await setDoc(doc(db, "groups", groupId, "pool", "neverWon"), { isActive: false });
    await setDoc(doc(db, "groups", groupId, "members", "owner"), { role: "owner" });
    await setDoc(doc(db, "games", "neverWon"), { title: "W", tags: ["party"] });
  });
  const owner = env.authenticatedContext("owner").firestore();
  const member = env.authenticatedContext("member").firestore();
  const restore = (db, id) => setDoc(doc(db, "groups", groupId, "pool", id), { isActive: true }, { merge: true });
  await assertFails(restore(member, "hiddenOld"));
  await assertFails(restore(owner, "neverWon"));
  await assertFails(updateDoc(doc(owner, "groups", groupId, "pool", "hiddenOld"), {
    isActive: true, injected: true,
  }));
  await assertSucceeds(restore(owner, "hiddenOld"));
  await assertSucceeds(restore(owner, "gone"));
});

for (const [uid, previousWinner] of [["moderator", "hiddenOld"], ["creator", "gone"]]) {
  it(`allows ${uid} to atomically override and restore a ${previousWinner} historical winner`, async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId, "members", uid), { role: uid === "moderator" ? "moderator" : "member" });
      await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
      await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
        groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
        winnerGameId: previousWinner, playedGameIds: [previousWinner],
        createdAt: now, updatedAt: now, createdBy: "owner",
      });
      await setDoc(doc(db, "groups", groupId, "pool", previousWinner), {
        isActive: false, lastWonSession: 1, restorationVoteId: "older-vote",
      });
      await setDoc(doc(db, "groups", groupId, "pool", "plain"), { isActive: true });
    });
    const db = env.authenticatedContext(uid).firestore();
    const pool = doc(db, "groups", groupId, "pool", previousWinner);
    const play = doc(db, "groups", groupId, "plays", "historical");
    await assertFails(updateDoc(pool, { isActive: true, restorationVoteId: "historical" }));
    await assertSucceeds(saveSessionOverride(db, {
      groupId, voteId: "historical", userId: uid, now: now + 1, winnerGameId: "plain",
      overrideResults: [{ gameId: "plain", isWinner: true }],
    }));
    assert.equal((await getDoc(pool)).data().isActive, true);
    assert.equal((await getDoc(play)).data().winnerGameId, "plain");
    assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "plain"))).data().isActive, false);
  });
}

it("rolls back the play override if a hidden previous winner cannot be restored", async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
      await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
      await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
        groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
        winnerGameId: "hiddenOld", playedGameIds: ["hiddenOld"], createdAt: now, updatedAt: now, createdBy: "owner",
      });
      await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), { isActive: false });
      await setDoc(doc(db, "groups", groupId, "pool", "plain"), { isActive: true });
    });
    const db = env.authenticatedContext("moderator").firestore();
    await assert.rejects(saveSessionOverride(db, {
      groupId, voteId: "historical", userId: "moderator", now: now + 1, winnerGameId: "plain",
      overrideResults: [{ gameId: "plain", isWinner: true }],
    }), /session history cannot be verified/);
    assert.equal((await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data().winnerGameId, "hiddenOld");
    assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "plain"))).data().isActive, true);
});

it("rejects unrelated members, false winner links, and extra fields in historical restorations", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
    await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
    await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
      groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
      winnerGameId: "hiddenOld", playedGameIds: ["hiddenOld"],
      createdAt: now, updatedAt: now, createdBy: "owner",
    });
    await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), { isActive: false, lastWonSession: 1 });
    await setDoc(doc(db, "groups", groupId, "pool", "gone"), { isActive: false, lastWonSession: 1 });
  });
  for (const [uid, gameId, extra] of [
    ["member", "hiddenOld", {}],
    ["moderator", "gone", {}],
    ["moderator", "hiddenOld", { playedCount: 999 }],
  ]) {
    const db = env.authenticatedContext(uid).firestore();
    const batch = writeBatch(db);
    batch.update(doc(db, "groups", groupId, "plays", "historical"), { winnerGameId: "plain", updatedAt: now + 1 });
    batch.update(doc(db, "groups", groupId, "pool", gameId), { isActive: true, restorationVoteId: "historical", ...extra });
    await assertFails(batch.commit());
  }
});

it("limits a historical vote creator to overriding that closed vote's results", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "members", "creator"), { role: "member" });
    await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
    await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
      groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
      winnerGameId: "hiddenOld", playedGameIds: ["hiddenOld"], participantIds: ["owner"],
      createdAt: now, updatedAt: now, createdBy: "owner",
    });
  });
  const db = env.authenticatedContext("creator").firestore();
  const play = doc(db, "groups", groupId, "plays", "historical");
  await assertFails(updateDoc(play, { participantIds: ["creator"], updatedAt: now + 1 }));
  await assertFails(updateDoc(play, { playedAt: now + 1 }));
  await assertSucceeds(updateDoc(play, { winnerGameId: "plain", overrideResults: [], updatedAt: now + 1 }));
  await env.withSecurityRulesDisabled(async (context) => {
    await updateDoc(doc(context.firestore(), "groups", groupId, "votes", "historical"), { status: "open" });
  });
  await assertFails(updateDoc(play, { winnerGameId: "hiddenOld", updatedAt: now + 2 }));
});

for (const [uid, previousWinner, hasLastWonSession] of [
  ["moderator", "hiddenOld", true], ["creator", "hiddenOld", true],
  ["moderator", "plain", false], ["creator", "plain", false],
]) {
  it(`${uid} restores effective ${previousWinner} with a conflicting stored winner${hasLastWonSession ? "" : " and legacy pool data"}`, async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId, "members", uid), { role: uid === "moderator" ? "moderator" : "member" });
      await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
      await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
        groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
        winnerGameId: "other", playedGameIds: ["other"], createdAt: now, updatedAt: now, createdBy: "owner",
        overrideResults: [
          { gameId: "other", isWinner: false },
          { gameId: previousWinner, isWinner: true },
        ],
      });
      await setDoc(doc(db, "groups", groupId, "pool", previousWinner), {
        isActive: false, ...(hasLastWonSession ? { lastWonSession: 1 } : {}),
      });
      await setDoc(doc(db, "groups", groupId, "pool", "notags"), { isActive: true });
    });
    const db = env.authenticatedContext(uid).firestore();
    if (!hasLastWonSession) {
      await assert.rejects(saveSessionOverride(db, {
        groupId, voteId: "historical", userId: uid, now: now + 1,
        winnerGameId: "notags", overrideResults: [{ gameId: "notags", isWinner: true }],
      }), /session history cannot be verified/);
      assert.equal((await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data().winnerGameId, "other");
      assert.equal((await getDoc(doc(db, "groups", groupId, "pool", previousWinner))).data().isActive, false);
      return;
    }
    await assertSucceeds(saveSessionOverride(db, {
      groupId, voteId: "historical", userId: uid, now: now + 1,
      winnerGameId: "notags", overrideResults: [{ gameId: "notags", isWinner: true }],
    }));
    const play = (await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data();
    assert.equal(resolveEffectiveWinnerId(play), "notags");
    assert.equal(play.winnerGameId, "notags");
    const previous = (await getDoc(doc(db, "groups", groupId, "pool", previousWinner))).data();
    assert.equal(previous.isActive, true);
    assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "notags"))).data().isActive, false);
  });
}

it("still rejects a hidden legacy winner without lastWonSession, even during override", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
    await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
    await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
      groupId, voteId: "historical", sessionIndex: 1, playedAt: now, winnerGameId: "hiddenOld",
      playedGameIds: ["hiddenOld"], createdAt: now, updatedAt: now, createdBy: "owner",
    });
    await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), { isActive: false });
    await setDoc(doc(db, "groups", groupId, "pool", "plain"), { isActive: true });
  });
  const db = env.authenticatedContext("moderator").firestore();
  await assert.rejects(saveSessionOverride(db, {
    groupId, voteId: "historical", userId: "moderator", now: now + 1,
    winnerGameId: "plain", overrideResults: [{ gameId: "plain", isWinner: true }],
  }), /session history cannot be verified/);
  assert.equal((await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data().winnerGameId, "hiddenOld");
  assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "plain"))).data().isActive, true);
});

it("denies restoring an old hidden winner after the pool records a newer win", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
    await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
    await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
      groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
      winnerGameId: "hiddenOld", playedGameIds: ["hiddenOld"],
      createdAt: now, updatedAt: now, createdBy: "owner",
    });
    await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), {
      isActive: false, lastWonSession: 4,
    });
  });
  const db = env.authenticatedContext("moderator").firestore();
  const batch = writeBatch(db);
  batch.update(doc(db, "groups", groupId, "plays", "historical"), {
    winnerGameId: "plain",
    overrideResults: [{ gameId: "plain", isWinner: true }],
    updatedAt: now + 1,
  });
  batch.update(doc(db, "groups", groupId, "pool", "hiddenOld"), {
    isActive: true, restorationVoteId: "historical",
  });
  await assertFails(batch.commit());
  assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "hiddenOld"))).data().isActive, false);
});

it("denies historical hidden restoration if either session marker is missing", async () => {
  for (const [sessionIndex, lastWonSession] of [[undefined, 1], [1, undefined]]) {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
      await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
      await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
        groupId, voteId: "historical", ...(sessionIndex === undefined ? {} : { sessionIndex }),
        playedAt: now, winnerGameId: "hiddenOld", playedGameIds: ["hiddenOld"],
        createdAt: now, updatedAt: now, createdBy: "owner",
      });
      await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), {
        isActive: false, ...(lastWonSession === undefined ? {} : { lastWonSession }),
      });
    });
    const db = env.authenticatedContext("moderator").firestore();
    const batch = writeBatch(db);
    batch.update(doc(db, "groups", groupId, "plays", "historical"), {
      winnerGameId: "plain",
      overrideResults: [{ gameId: "plain", isWinner: true }],
      updatedAt: now + 1,
    });
    batch.update(doc(db, "groups", groupId, "pool", "hiddenOld"), {
      isActive: true, restorationVoteId: "historical",
    });
    await assertFails(batch.commit());
  }
});

it("reports an explicit error instead of restoring when historical session ordering cannot be verified", async () => {
  for (const [sessionIndex, lastWonSession, message] of [
    [1, 4, /won again in a later session/],
    [undefined, 1, /session history cannot be verified/],
    [1, undefined, /session history cannot be verified/],
  ]) {
    await env.clearFirestore();
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId), { ownerId: "owner" });
      await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
      await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
      await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
        groupId, voteId: "historical", ...(sessionIndex === undefined ? {} : { sessionIndex }),
        playedAt: now, winnerGameId: "hiddenOld", playedGameIds: ["hiddenOld"],
        createdAt: now, updatedAt: now, createdBy: "owner",
      });
      await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), {
        isActive: false, ...(lastWonSession === undefined ? {} : { lastWonSession }),
      });
    });
    const db = env.authenticatedContext("moderator").firestore();
    await assert.rejects(saveSessionOverride(db, {
      groupId, voteId: "historical", userId: "moderator", now: now + 1,
      winnerGameId: "plain", overrideResults: [{ gameId: "plain", isWinner: true }],
    }), message);
    assert.equal((await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data().winnerGameId, "hiddenOld");
    assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "hiddenOld"))).data().isActive, false);
  }
});

it("does not reactivate a visible previous winner after a newer win", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
    await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
    await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
      groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
      winnerGameId: "plain", playedGameIds: ["plain"],
      createdAt: now, updatedAt: now, createdBy: "owner",
    });
    await setDoc(doc(db, "groups", groupId, "pool", "plain"), {
      isActive: false, lastWonSession: 4,
    });
    await setDoc(doc(db, "groups", groupId, "pool", "notags"), { isActive: true });
  });
  const db = env.authenticatedContext("moderator").firestore();
  await assertSucceeds(saveSessionOverride(db, {
    groupId, voteId: "historical", userId: "moderator", now: now + 1,
    winnerGameId: "notags", overrideResults: [{ gameId: "notags", isWinner: true }],
  }));
  const play = (await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data();
  assert.equal(play.winnerGameId, "notags");
  assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "plain"))).data().isActive, false);
  assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "notags"))).data().isActive, false);
});

it("reports an explicit error when the historical play is missing and writes nothing", async () => {
  const db = env.authenticatedContext("member").firestore();
  await assert.rejects(saveSessionOverride(db, {
    groupId, voteId: "missing", userId: "member", now: now + 1,
    winnerGameId: "plain", overrideResults: [{ gameId: "plain", isWinner: true }],
  }), /history record is missing/);
  assert.equal((await getDoc(doc(db, "groups", groupId, "plays", "missing"))).exists(), false);
});

it("denies restoring a raw winner while leaving its effective override winner unchanged", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
    await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
    await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
      groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
      winnerGameId: "hiddenOld", playedGameIds: ["hiddenOld"],
      overrideResults: [{ gameId: "hiddenOld", isWinner: true }],
      createdAt: now, updatedAt: now, createdBy: "owner",
    });
    await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), { isActive: false, lastWonSession: 1 });
  });
  const db = env.authenticatedContext("moderator").firestore();
  const batch = writeBatch(db);
  batch.update(doc(db, "groups", groupId, "plays", "historical"), { winnerGameId: "plain", updatedAt: now + 1 });
  batch.update(doc(db, "groups", groupId, "pool", "hiddenOld"), {
    isActive: true, restorationVoteId: "historical",
  });
  await assertFails(batch.commit());
  assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "hiddenOld"))).data().isActive, false);
  assert.equal((await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data().winnerGameId, "hiddenOld");
});

for (const paddedWinner of [" hiddenOld", "hiddenOld ", "\u00a0hiddenOld", "hiddenOld\u00a0"]) {
  it(`denies canonical winner IDs padded with ${paddedWinner.startsWith(" ") || paddedWinner.startsWith("\u00a0") ? "leading" : "trailing"} whitespace`, async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
      await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
      await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
        groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
        winnerGameId: "hiddenOld", playedGameIds: ["hiddenOld"],
        createdAt: now, updatedAt: now, createdBy: "owner",
      });
      await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), { isActive: false, lastWonSession: 1 });
    });
    const db = env.authenticatedContext("moderator").firestore();
    const batch = writeBatch(db);
    batch.update(doc(db, "groups", groupId, "plays", "historical"), {
      winnerGameId: paddedWinner,
      overrideResults: [{ gameId: paddedWinner, isWinner: true }],
      updatedAt: now + 1,
    });
    batch.update(doc(db, "groups", groupId, "pool", "hiddenOld"), {
      isActive: true, restorationVoteId: "historical",
    });
    await assertFails(batch.commit());
    assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "hiddenOld"))).data().isActive, false);
  });
}

for (const overrideResults of [undefined, []]) {
  for (const paddedWinner of [" hiddenOld", "hiddenOld ", "\u00a0hiddenOld", "hiddenOld\u00a0"]) {
    it(`denies raw fallback winner padded with whitespace when overrides are ${overrideResults ? "empty" : "absent"}`, async () => {
      await env.withSecurityRulesDisabled(async (context) => {
        const db = context.firestore();
        await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
        await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
        await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
          groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
          winnerGameId: "hiddenOld", playedGameIds: ["hiddenOld"],
          ...(overrideResults ? { overrideResults } : {}),
          createdAt: now, updatedAt: now, createdBy: "owner",
        });
        await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), { isActive: false, lastWonSession: 1 });
      });
      const db = env.authenticatedContext("moderator").firestore();
      const batch = writeBatch(db);
      batch.update(doc(db, "groups", groupId, "plays", "historical"), {
        winnerGameId: paddedWinner, updatedAt: now + 1,
      });
      batch.update(doc(db, "groups", groupId, "pool", "hiddenOld"), {
        isActive: true, restorationVoteId: "historical",
      });
      await assertFails(batch.commit());
      assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "hiddenOld"))).data().isActive, false);
    });
  }
}

it("orders a corrected winner first and preserves legacy result rows", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
    await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
    await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
      groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
      winnerGameId: "other", playedGameIds: ["other", "hiddenOld"],
      overrideResults: [
        { gameId: "other", votes: 1, score: 1, isWinner: false },
        { gameId: "hiddenOld", votes: 1, score: 1, isWinner: true },
      ],
      createdAt: now, updatedAt: now, createdBy: "owner",
    });
    await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), { isActive: false, lastWonSession: 1 });
    await setDoc(doc(db, "groups", groupId, "pool", "plain"), { isActive: true });
  });
  const db = env.authenticatedContext("moderator").firestore();
  const results = [
    { gameId: "other", votes: 2, score: 2, isWinner: false },
    { gameId: "plain", votes: 1, score: 1, isWinner: true },
    { gameId: "hiddenOld", votes: 0, score: 0, isWinner: false },
  ];
  await assertSucceeds(saveSessionOverride(db, {
    groupId, voteId: "historical", userId: "moderator", now: now + 1,
    winnerGameId: "plain", overrideResults: results,
  }));
  const play = (await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data();
  assert.deepEqual(play.overrideResults, [results[1], results[0], results[2]]);
  assert.equal(resolveEffectiveWinnerId(play), "plain");
  assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "hiddenOld"))).data().isActive, true);
});

it("fails before updates when no-winner result rows cannot safely restore a hidden previous winner", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
    await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
    await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
      groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
      winnerGameId: "other", playedGameIds: ["other", "hiddenOld"],
      overrideResults: [{ gameId: "hiddenOld", isWinner: true }],
      createdAt: now, updatedAt: now, createdBy: "owner",
    });
    await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), { isActive: false, lastWonSession: 1 });
  });
  const db = env.authenticatedContext("moderator").firestore();
  const results = [
    { gameId: "plain", votes: 2, score: 2, isWinner: false },
    { gameId: "hiddenOld", votes: 1, score: 1, isWinner: false },
  ];
  await assert.rejects(saveSessionOverride(db, {
    groupId, voteId: "historical", userId: "moderator", now: now + 1,
    winnerGameId: null, overrideResults: results,
  }), /Cannot save a no-winner correction with result rows/);
  const play = (await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data();
  assert.equal(play.winnerGameId, "other");
  assert.deepEqual(play.overrideResults, [{ gameId: "hiddenOld", isWinner: true }]);
  assert.equal(resolveEffectiveWinnerId(play), "hiddenOld");
  assert.equal(resolveEffectiveWinnerId({ winnerGameId: "legacy", overrideResults: results }), "legacy");
  assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "hiddenOld"))).data().isActive, false);
});

it("restores a visible prior winner when applying a no-winner correction with result rows", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
    await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
    await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
      groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
      winnerGameId: "plain", playedGameIds: ["plain"],
      createdAt: now, updatedAt: now, createdBy: "owner",
    });
    await setDoc(doc(db, "groups", groupId, "pool", "plain"), { isActive: false, lastWonSession: 1 });
  });
  const db = env.authenticatedContext("moderator").firestore();
  const results = [{ gameId: "plain", votes: 1, score: 1, isWinner: false }];
  await assertSucceeds(saveSessionOverride(db, {
    groupId, voteId: "historical", userId: "moderator", now: now + 1,
    winnerGameId: null, overrideResults: results,
  }));
  const play = (await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data();
  assert.deepEqual(play.overrideResults, results);
  assert.equal(resolveEffectiveWinnerId(play), null);
  assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "plain"))).data().isActive, true);
});

it("restores a hidden prior winner when a no-winner correction has no result rows", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
    await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
    await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
      groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
      winnerGameId: "hiddenOld", playedGameIds: ["hiddenOld"],
      createdAt: now, updatedAt: now, createdBy: "owner",
    });
    await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), { isActive: false, lastWonSession: 1 });
  });
  const db = env.authenticatedContext("moderator").firestore();
  await assertSucceeds(saveSessionOverride(db, {
    groupId, voteId: "historical", userId: "moderator", now: now + 1,
    winnerGameId: null, overrideResults: [],
  }));
  const play = (await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data();
  assert.deepEqual(play.overrideResults, []);
  assert.equal(resolveEffectiveWinnerId(play), null);
  assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "hiddenOld"))).data().isActive, true);
});

for (const uid of ["moderator", "creator"]) {
  it(`${uid} aligns a legacy winner while backfilling missing creation fields`, async () => {
    await env.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId, "members", uid), { role: uid === "moderator" ? "moderator" : "member" });
      await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
      await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
        groupId, voteId: "historical", sessionIndex: 1, playedAt: now,
        winnerGameId: "other", playedGameIds: ["other"],
        overrideResults: [{ gameId: "hiddenOld", isWinner: true }],
      });
      await setDoc(doc(db, "groups", groupId, "pool", "hiddenOld"), { isActive: false, lastWonSession: 1 });
      await setDoc(doc(db, "groups", groupId, "pool", "plain"), { isActive: true });
    });
    const db = env.authenticatedContext(uid).firestore();
    await assertSucceeds(saveSessionOverride(db, {
      groupId, voteId: "historical", userId: uid, now: now + 1,
      winnerGameId: "plain", overrideResults: [{ gameId: "plain", isWinner: true }],
    }));
    const play = (await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data();
    assert.equal(play.createdAt, now + 1);
    assert.equal(play.createdBy, uid);
    assert.equal(play.winnerGameId, "plain");
    assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "hiddenOld"))).data().isActive, true);
  });
}

it("handles an absent winner without a preliminary write, backfilling creation fields in the override", async () => {
  await env.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", groupId, "members", "moderator"), { role: "moderator" });
    await setDoc(doc(db, "groups", groupId, "votes", "historical"), { status: "closed", createdBy: "creator" });
    await setDoc(doc(db, "groups", groupId, "plays", "historical"), {
      groupId, voteId: "historical", sessionIndex: 1, playedAt: now, updatedAt: now, playedGameIds: [],
    });
    await setDoc(doc(db, "groups", groupId, "pool", "plain"), { isActive: true });
  });
  const db = env.authenticatedContext("moderator").firestore();
  await assertSucceeds(saveSessionOverride(db, {
    groupId, voteId: "historical", userId: "moderator", now: now + 1,
    winnerGameId: "plain", overrideResults: [{ gameId: "plain", isWinner: true }],
  }));
  const play = (await getDoc(doc(db, "groups", groupId, "plays", "historical"))).data();
  assert.equal(play.createdAt, now + 1);
  assert.equal(play.createdBy, "moderator");
  assert.equal(play.winnerGameId, "plain");
  assert.equal((await getDoc(doc(db, "groups", groupId, "pool", "plain"))).data().isActive, false);
});
