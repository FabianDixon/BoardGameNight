import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createAutoCloseGuard } from "../src/utils/sessionReliability.js";

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("auto-close retry guard", () => {
  it("holds the guard during a failed attempt and retries after a delay", async () => {
    let timer;
    let retries = 0;
    let calls = 0;
    const guard = createAutoCloseGuard(() => retries++, {
      schedule: (callback, delay) => {
        assert.equal(delay, 5000);
        timer = callback;
        return 1;
      },
      onError: () => {},
    });
    const fail = async () => { calls++; throw new Error("offline"); };
    guard.run("vote", fail);
    guard.run("vote", fail);
    await flush();
    assert.equal(calls, 1);
    guard.run("vote", fail);
    assert.equal(calls, 1);
    timer();
    assert.equal(retries, 1);
    guard.run("vote", async () => { calls++; });
    await flush();
    assert.equal(calls, 2);
    guard.run("vote", fail);
    await flush();
    assert.equal(calls, 2);
  });

  it("cancels retries on reset, including failures settling after reset", async () => {
    let scheduled = 0;
    let cancelled = 0;
    let reject;
    const guard = createAutoCloseGuard(() => assert.fail("unexpected retry"), {
      schedule: () => { scheduled++; return 1; },
      cancel: () => { cancelled++; },
      onError: () => {},
    });
    guard.run("first", () => new Promise((_, rejectPromise) => { reject = rejectPromise; }));
    await flush();
    guard.reset();
    reject(new Error("late failure"));
    await flush();
    assert.equal(scheduled, 0);
    guard.run("second", async () => { throw new Error("failure"); });
    await flush();
    assert.equal(scheduled, 1);
    guard.reset();
    assert.equal(cancelled, 1);
  });

  it("does not start an attempt invalidated before it runs", async () => {
    let calls = 0;
    const guard = createAutoCloseGuard(() => {});
    guard.run("vote", () => { calls++; });
    guard.reset();
    await flush();
    assert.equal(calls, 0);
  });

  it("releases the guard for a skipped attempt", async () => {
    let calls = 0;
    const guard = createAutoCloseGuard(() => {});
    guard.run("vote", () => { calls++; return false; });
    await flush();
    guard.run("vote", () => { calls++; });
    await flush();
    assert.equal(calls, 2);
  });
});
