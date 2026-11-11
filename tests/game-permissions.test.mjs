import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { canEditGame } from "../src/utils/gamePermissions.js";

describe("game editing permissions", () => {
  const game = { id: "game-1", createdBy: "creator" };

  it("allows the creator and an administrator", () => {
    assert.equal(canEditGame(game, "creator"), true);
    assert.equal(canEditGame(game, "admin", true), true);
  });

  it("denies other users and invalid administrator flags", () => {
    assert.equal(canEditGame(game, "member"), false);
    assert.equal(canEditGame(game, "admin", false), false);
    assert.equal(canEditGame(game, "admin", "true"), false);
    assert.equal(canEditGame(game, null, true), false);
    assert.equal(canEditGame(null, "admin", true), false);
  });
});
