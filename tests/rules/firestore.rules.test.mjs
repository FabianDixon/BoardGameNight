import { after, before, beforeEach, describe, it } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { initializeTestEnvironment, assertFails, assertSucceeds } from "@firebase/rules-unit-testing";
import { deleteDoc, doc, getDoc, setDoc, updateDoc } from "firebase/firestore";

const PROJECT_ID = "demo-boardgame-night";
const RULES_PATH = new URL("../../firestore.rules", import.meta.url);

const now = 1_700_000_000_000;
const groupId = "grp-main";
const ownerUid = "ownerUid";
const memberUid = "memberUid";
const modUid = "modUid";
const creatorUid = "creatorUid";
const otherUid = "otherUid";

let testEnv;

function authedDb(uid) {
  return testEnv.authenticatedContext(uid).firestore();
}

async function seedGroupWithMembers({
  gid = groupId,
  ownerId = ownerUid,
  members = [],
} = {}) {
  await testEnv.withSecurityRulesDisabled(async (context) => {
    const db = context.firestore();
    await setDoc(doc(db, "groups", gid), {
      name: `Group ${gid}`,
      ownerId,
      createdAt: now,
    });

    for (const member of members) {
      await setDoc(doc(db, "groups", gid, "members", member.userId), {
        role: member.role,
        nickname: member.nickname ?? member.userId,
        avatarId: member.avatarId ?? "avatar-default",
        joinedAt: now,
      });
    }
  });
}

before(async () => {
  testEnv = await initializeTestEnvironment({
    projectId: PROJECT_ID,
    firestore: {
      rules: readFileSync(RULES_PATH, "utf8"),
    },
  });
});

after(async () => {
  await testEnv.cleanup();
});

beforeEach(async () => {
  await testEnv.clearFirestore();
});

describe("games rules", () => {
  it("allows signed-in user to create a game when createdBy matches self", async () => {
    const creatorDb = authedDb(creatorUid);

    await assertSucceeds(
      setDoc(doc(creatorDb, "games", "g-create-ok"), {
        title: "Terraforming Mars",
        description: "Engine building",
        imageUrl: "",
        tags: ["strategy"],
        createdBy: creatorUid,
        ratingTotal: 0,
        ratingCount: 0,
        createdAt: now,
      })
    );

    await assertFails(
      setDoc(doc(creatorDb, "games", "g-create-bad"), {
        title: "Bad CreatedBy",
        description: "Should fail",
        createdBy: otherUid,
        ratingTotal: 0,
        ratingCount: 0,
        createdAt: now,
      })
    );
  });

  it("keeps metadata editing open but restricts delete to creator", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "games", "g1"), {
        title: "Catan",
        description: "Trade resources",
        imageUrl: "",
        tags: ["strategy"],
        createdBy: "alice",
        ratingTotal: 0,
        ratingCount: 0,
        createdAt: now,
      });
    });

    const bobDb = authedDb("bob");
    const aliceDb = authedDb("alice");

    await assertSucceeds(
      updateDoc(doc(bobDb, "games", "g1"), {
        title: "Catan (edited by collaborator)",
        updatedAt: now + 1,
      })
    );

    await assertFails(deleteDoc(doc(bobDb, "games", "g1")));
    await assertSucceeds(deleteDoc(doc(aliceDb, "games", "g1")));
  });
});

describe("group membership rules", () => {
  it("allows member to create own membership doc with valid role", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId), {
        name: "Group for membership create",
        ownerId: ownerUid,
        createdAt: now,
      });
    });

    const memberDb = authedDb(memberUid);

    await assertSucceeds(
      setDoc(doc(memberDb, "groups", groupId, "members", memberUid), {
        role: "member",
        nickname: "Member",
        avatarId: "avatar-2",
        joinedAt: now,
      })
    );
  });

  it("denies membership create with invalid role", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId), {
        name: "Group for invalid role",
        ownerId: ownerUid,
        createdAt: now,
      });
    });

    const memberDb = authedDb(memberUid);

    await assertFails(
      setDoc(doc(memberDb, "groups", groupId, "members", memberUid), {
        role: "admin",
        nickname: "Member",
        avatarId: "avatar-2",
        joinedAt: now,
      })
    );
  });

  it("allows self profile sync but blocks self role escalation", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", "grp1"), {
        name: "Group 1",
        ownerId: "alice",
        createdAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "alice"), {
        role: "owner",
        nickname: "Alice",
        avatarId: "avatar-1",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "bob"), {
        role: "member",
        nickname: "Bob",
        avatarId: "avatar-2",
        joinedAt: now,
      });
    });

    const bobDb = authedDb("bob");

    await assertSucceeds(
      updateDoc(doc(bobDb, "groups", "grp1", "members", "bob"), {
        nickname: "Bob Updated",
      })
    );

    await assertFails(
      updateDoc(doc(bobDb, "groups", "grp1", "members", "bob"), {
        role: "moderator",
      })
    );
  });

  it("allows owner to change another member role", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", "grp1"), {
        name: "Group 1",
        ownerId: "alice",
        createdAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "alice"), {
        role: "owner",
        nickname: "Alice",
        avatarId: "avatar-1",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "bob"), {
        role: "member",
        nickname: "Bob",
        avatarId: "avatar-2",
        joinedAt: now,
      });
    });

    const aliceDb = authedDb("alice");

    await assertSucceeds(
      updateDoc(doc(aliceDb, "groups", "grp1", "members", "bob"), {
        role: "moderator",
      })
    );

    const snap = await getDoc(doc(aliceDb, "groups", "grp1", "members", "bob"));
    assert.equal(snap.data()?.role, "moderator");
  });

  it("allows self avatar update but denies self promotion to owner", async () => {
    await seedGroupWithMembers({
      gid: groupId,
      ownerId: ownerUid,
      members: [
        { userId: ownerUid, role: "owner", nickname: "Owner" },
        { userId: memberUid, role: "member", nickname: "Member" },
      ],
    });

    const memberDb = authedDb(memberUid);

    await assertSucceeds(
      updateDoc(doc(memberDb, "groups", groupId, "members", memberUid), {
        avatarId: "avatar-updated",
      })
    );

    await assertFails(
      updateDoc(doc(memberDb, "groups", groupId, "members", memberUid), {
        role: "owner",
      })
    );
  });
});

describe("plays history rules", () => {
  it("allows group member to create play with createdBy == self", async () => {
    await seedGroupWithMembers({
      gid: groupId,
      ownerId: ownerUid,
      members: [
        { userId: ownerUid, role: "owner" },
        { userId: creatorUid, role: "member" },
      ],
    });

    const creatorDb = authedDb(creatorUid);

    await assertSucceeds(
      setDoc(doc(creatorDb, "groups", groupId, "plays", "play-create-ok"), {
        groupId,
        voteId: "vote-create-1",
        sessionIndex: 1,
        playedAt: now,
        winnerGameId: "g1",
        playedGameIds: ["g1"],
        participantIds: [creatorUid],
        createdAt: now,
        updatedAt: now,
        createdBy: creatorUid,
      })
    );

    await assertFails(
      setDoc(doc(creatorDb, "groups", groupId, "plays", "play-create-bad"), {
        groupId,
        voteId: "vote-create-2",
        sessionIndex: 1,
        playedAt: now,
        winnerGameId: "g1",
        playedGameIds: ["g1"],
        participantIds: [creatorUid],
        createdAt: now,
        updatedAt: now,
        createdBy: ownerUid,
      })
    );
  });

  it("allows owner/mod/creator edits but denies normal member edits", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", "grp1"), {
        name: "Group 1",
        ownerId: "alice",
        createdAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "alice"), {
        role: "owner",
        nickname: "Alice",
        avatarId: "avatar-1",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "bob"), {
        role: "member",
        nickname: "Bob",
        avatarId: "avatar-2",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "carol"), {
        role: "moderator",
        nickname: "Carol",
        avatarId: "avatar-3",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "dave"), {
        role: "member",
        nickname: "Dave",
        avatarId: "avatar-4",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "plays", "play-1"), {
        groupId: "grp1",
        voteId: "vote-1",
        sessionIndex: 1,
        playedAt: now,
        winnerGameId: "g1",
        playedGameIds: ["g1"],
        participantIds: ["alice", "bob"],
        resultMode: "ranked",
        placements: [{ userId: "alice", place: 1 }, { userId: "bob", place: 2 }],
        createdAt: now,
        updatedAt: now,
        createdBy: "bob",
      });
    });

    const bobDb = authedDb("bob");     // creator
    const carolDb = authedDb("carol"); // moderator
    const daveDb = authedDb("dave");   // normal member

    await assertSucceeds(
      updateDoc(doc(bobDb, "groups", "grp1", "plays", "play-1"), {
        playedAt: now + 10,
        updatedAt: now + 10,
      })
    );

    await assertSucceeds(
      updateDoc(doc(carolDb, "groups", "grp1", "plays", "play-1"), {
        playedAt: now + 20,
        updatedAt: now + 20,
      })
    );

    await assertFails(
      updateDoc(doc(daveDb, "groups", "grp1", "plays", "play-1"), {
        playedAt: now + 30,
        updatedAt: now + 30,
      })
    );
  });

  it("denies improper immutable field changes on play updates", async () => {
    await seedGroupWithMembers({
      gid: groupId,
      ownerId: ownerUid,
      members: [
        { userId: ownerUid, role: "owner" },
        { userId: modUid, role: "moderator" },
        { userId: creatorUid, role: "member" },
      ],
    });

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", groupId, "plays", "play-immutable-1"), {
        groupId,
        voteId: "vote-immutable-1",
        sessionIndex: 3,
        playedAt: now,
        winnerGameId: "g1",
        playedGameIds: ["g1", "g2"],
        participantIds: [ownerUid, creatorUid],
        createdAt: now,
        updatedAt: now,
        createdBy: creatorUid,
      });
    });

    const ownerDb = authedDb(ownerUid);

    await assertFails(
      updateDoc(doc(ownerDb, "groups", groupId, "plays", "play-immutable-1"), {
        groupId: "other-group",
      })
    );

    await assertFails(
      updateDoc(doc(ownerDb, "groups", groupId, "plays", "play-immutable-1"), {
        voteId: "vote-rewritten",
      })
    );

    await assertFails(
      updateDoc(doc(ownerDb, "groups", groupId, "plays", "play-immutable-1"), {
        createdBy: ownerUid,
      })
    );

    await assertFails(
      updateDoc(doc(ownerDb, "groups", groupId, "plays", "play-immutable-1"), {
        createdAt: now + 999,
      })
    );
  });
});

describe("vote lifecycle rules", () => {
  it("allows member vote create with self-createdBy and valid status", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", "grp1"), {
        name: "Group 1",
        ownerId: "alice",
        createdAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "alice"), {
        role: "owner",
        nickname: "Alice",
        avatarId: "avatar-1",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "bob"), {
        role: "member",
        nickname: "Bob",
        avatarId: "avatar-2",
        joinedAt: now,
      });
    });

    const bobDb = authedDb("bob");

    await assertSucceeds(
      setDoc(doc(bobDb, "groups", "grp1", "votes", "vote-1"), {
        createdBy: "bob",
        status: "collecting",
        createdAt: now,
      })
    );

    await assertFails(
      setDoc(doc(bobDb, "groups", "grp1", "votes", "vote-2"), {
        createdBy: "alice",
        status: "collecting",
        createdAt: now,
      })
    );
  });

  it("enforces collecting->open transition shape", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", "grp1"), {
        name: "Group 1",
        ownerId: "alice",
        createdAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "alice"), {
        role: "owner",
        nickname: "Alice",
        avatarId: "avatar-1",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "bob"), {
        role: "member",
        nickname: "Bob",
        avatarId: "avatar-2",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "votes", "vote-1"), {
        createdBy: "alice",
        status: "collecting",
        createdAt: now,
      });
    });

    const bobDb = authedDb("bob");

    await assertSucceeds(
      updateDoc(doc(bobDb, "groups", "grp1", "votes", "vote-1"), {
        status: "open",
        openedAt: now + 1,
        candidates: ["g1", "g2"],
      })
    );

    await assertFails(
      updateDoc(doc(bobDb, "groups", "grp1", "votes", "vote-1"), {
        status: "open",
        openedAt: now + 2,
        candidates: ["g1"],
        extraField: true,
      })
    );
  });

  it("enforces open->closed transition shape", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", "grp1"), {
        name: "Group 1",
        ownerId: "alice",
        createdAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "alice"), {
        role: "owner",
        nickname: "Alice",
        avatarId: "avatar-1",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "bob"), {
        role: "member",
        nickname: "Bob",
        avatarId: "avatar-2",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "votes", "vote-1"), {
        createdBy: "alice",
        status: "open",
        createdAt: now,
        openedAt: now + 1,
        candidates: ["g1", "g2"],
      });
    });

    const bobDb = authedDb("bob");

    await assertSucceeds(
      updateDoc(doc(bobDb, "groups", "grp1", "votes", "vote-1"), {
        status: "closed",
        closedAt: now + 10,
        winnerGameId: "g1",
        scoreBreakdown: [{ gameId: "g1", score: 2 }],
        weightsUsed: { base: 1 },
      })
    );

    await assertFails(
      updateDoc(doc(bobDb, "groups", "grp1", "votes", "vote-1"), {
        status: "closed",
        closedAt: now + 11,
        winnerGameId: "g1",
      })
    );
  });
});

describe("active session rules", () => {
  it("requires ownerId=self on create", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", "grp1"), {
        name: "Group 1",
        ownerId: "alice",
        createdAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "alice"), {
        role: "owner",
        nickname: "Alice",
        avatarId: "avatar-1",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "bob"), {
        role: "member",
        nickname: "Bob",
        avatarId: "avatar-2",
        joinedAt: now,
      });
    });

    const bobDb = authedDb("bob");

    await assertSucceeds(
      setDoc(doc(bobDb, "groups", "grp1", "activeSession", "meta"), {
        ownerId: "bob",
        status: "collecting",
        activeVoteId: "vote-1",
        sessionIndex: 0,
        updatedAt: now,
      })
    );

    await assertFails(
      setDoc(doc(bobDb, "groups", "grp1", "activeSession", "meta2"), {
        ownerId: "alice",
        status: "collecting",
        activeVoteId: "vote-1",
        sessionIndex: 0,
        updatedAt: now,
      })
    );
  });

  it("enforces member phase transitions", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", "grp1"), {
        name: "Group 1",
        ownerId: "alice",
        createdAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "alice"), {
        role: "owner",
        nickname: "Alice",
        avatarId: "avatar-1",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "bob"), {
        role: "member",
        nickname: "Bob",
        avatarId: "avatar-2",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "activeSession", "meta"), {
        ownerId: "alice",
        status: "collecting",
        activeVoteId: "vote-1",
        sessionIndex: 7,
        updatedAt: now,
      });
    });

    const bobDb = authedDb("bob");

    await assertSucceeds(
      updateDoc(doc(bobDb, "groups", "grp1", "activeSession", "meta"), {
        status: "open",
        updatedAt: now + 1,
      })
    );

    await assertFails(
      updateDoc(doc(bobDb, "groups", "grp1", "activeSession", "meta"), {
        status: "open",
        activeVoteId: "vote-2",
        updatedAt: now + 2,
      })
    );
  });
});

describe("submissions and ballots rules", () => {
  it("enforces submissions only for self during collecting", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", "grp1"), {
        name: "Group 1",
        ownerId: "alice",
        createdAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "alice"), {
        role: "owner",
        nickname: "Alice",
        avatarId: "avatar-1",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "bob"), {
        role: "member",
        nickname: "Bob",
        avatarId: "avatar-2",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "votes", "vote-1"), {
        createdBy: "alice",
        status: "collecting",
        createdAt: now,
      });
    });

    const bobDb = authedDb("bob");

    await assertSucceeds(
      setDoc(doc(bobDb, "groups", "grp1", "votes", "vote-1", "submissions", "bob"), {
        gameId: "g1",
        submittedAt: now + 1,
      })
    );

    await assertFails(
      setDoc(doc(bobDb, "groups", "grp1", "votes", "vote-1", "submissions", "alice"), {
        gameId: "g2",
        submittedAt: now + 2,
      })
    );

    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await updateDoc(doc(db, "groups", "grp1", "votes", "vote-1"), {
        status: "open",
      });
    });

    await assertFails(
      setDoc(doc(bobDb, "groups", "grp1", "votes", "vote-1", "submissions", "bob"), {
        gameId: "g1",
        submittedAt: now + 3,
      })
    );
  });

  it("enforces ballots to self, open phase, candidate list, and disallow-own-submission flag", async () => {
    await testEnv.withSecurityRulesDisabled(async (context) => {
      const db = context.firestore();
      await setDoc(doc(db, "groups", "grp1"), {
        name: "Group 1",
        ownerId: "alice",
        createdAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "alice"), {
        role: "owner",
        nickname: "Alice",
        avatarId: "avatar-1",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "members", "bob"), {
        role: "member",
        nickname: "Bob",
        avatarId: "avatar-2",
        joinedAt: now,
      });
      await setDoc(doc(db, "groups", "grp1", "settings", "meta"), {
        disallowVotingOwnSubmission: true,
      });
      await setDoc(doc(db, "groups", "grp1", "votes", "vote-1"), {
        createdBy: "alice",
        status: "open",
        createdAt: now,
        candidates: ["g1", "g2"],
      });
      await setDoc(doc(db, "groups", "grp1", "votes", "vote-1", "submissions", "bob"), {
        gameId: "g1",
        submittedAt: now,
      });
    });

    const bobDb = authedDb("bob");

    await assertFails(
      setDoc(doc(bobDb, "groups", "grp1", "votes", "vote-1", "ballots", "bob"), {
        gameId: "g1",
        submittedAt: now + 1,
      })
    );

    await assertSucceeds(
      setDoc(doc(bobDb, "groups", "grp1", "votes", "vote-1", "ballots", "bob"), {
        gameId: "g2",
        submittedAt: now + 2,
      })
    );

    await assertFails(
      setDoc(doc(bobDb, "groups", "grp1", "votes", "vote-1", "ballots", "alice"), {
        gameId: "g2",
        submittedAt: now + 3,
      })
    );

    await assertFails(
      setDoc(doc(bobDb, "groups", "grp1", "votes", "vote-1", "ballots", "bob"), {
        gameId: "g999",
        submittedAt: now + 4,
      })
    );
  });
});
