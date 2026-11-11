import { it } from "node:test";
import assert from "node:assert/strict";
import { buildVotingCandidates, getHiddenTagSet, isGameHiddenByTags } from "../src/utils/hiddenTags.js";

const games = [
  { id: "a", tags: ["Co-op"] },
  { id: "b", tags: ["party"] },
  { id: "c" },
];
const hidden = getHiddenTagSet({ hiddenTags: ["party"] });

it("matches normalized hidden tags", () => {
  assert.equal(isGameHiddenByTags({ tags: ["Party"] }, hidden), true);
  assert.equal(isGameHiddenByTags({ tags: ["coop"] }, hidden), false);
  assert.equal(isGameHiddenByTags({}, hidden), false);
});

it("excludes hidden, unowned/missing games from new snapshots without touching inputs", () => {
  const pool = ["a", "b", "gone"];
  const submitted = ["c", "b"];
  const result = buildVotingCandidates({
    poolActiveIds: pool, submittedIds: submitted, eligibleGames: games, hiddenTags: hidden, ready: true,
  });
  assert.deepEqual(result.candidates, ["a", "c"]);
  assert.deepEqual(result.excluded, [
    { id: "b", reason: "HIDDEN_TAG" },
    { id: "gone", reason: "UNAVAILABLE" },
  ]);
  assert.deepEqual(pool, ["a", "b", "gone"]);
});

it("refuses to build when data is not loaded or settings unknown", () => {
  for (const args of [{ ready: false, hiddenTags: hidden }, { ready: true, hiddenTags: null }]) {
    const r = buildVotingCandidates({ poolActiveIds: ["a"], eligibleGames: games, ...args });
    assert.equal(r.ok, false);
    assert.equal(r.reason, "NOT_READY");
  }
});

it("fails with NO_CANDIDATES when everything is excluded", () => {
  const r = buildVotingCandidates({ poolActiveIds: ["b"], eligibleGames: games, hiddenTags: hidden, ready: true });
  assert.equal(r.ok, false);
  assert.equal(r.reason, "NO_CANDIDATES");
});
