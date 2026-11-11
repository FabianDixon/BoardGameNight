import { describe, it } from "node:test";
import assert from "node:assert/strict";
import { createLatestGuard, readLoad, watchAccess } from "../src/utils/loadReliability.js";

const flush = () => new Promise((resolve) => setImmediate(resolve));

describe("watchAccess", () => {
  it("recovers after timeouts, exposing errors, without reload", async () => {
    const events = [];
    const timers = [];
    let calls = 0;
    watchAccess({
      check: async () => {
        if (++calls < 3) throw new Error("MEMBERSHIP_NOT_VISIBLE_YET");
      },
      onChecking: () => events.push("checking"),
      onReady: () => events.push("ready"),
      onError: (_e, n) => events.push(`error${n}`),
      schedule: (fn, delay) => { timers.push({ fn, delay }); return timers.length; },
      cancelSchedule: () => {},
    });
    await flush();
    assert.deepEqual(events, ["checking", "error1"]);
    timers.shift().fn();
    await flush();
    const second = timers.shift();
    assert.equal(second.delay, 2000);
    second.fn();
    await flush();
    assert.deepEqual(events.at(-1), "ready");
  });

  it("never reports ready after cancel", async () => {
    let release;
    let ready = false;
    const watcher = watchAccess({
      check: () => new Promise((resolve) => { release = resolve; }),
      onReady: () => { ready = true; },
      onError: () => {},
    });
    watcher.cancel();
    release();
    await flush();
    assert.equal(ready, false);
  });

  it("stops retrying once cancelled and supports manual retry", async () => {
    let calls = 0;
    const timers = [];
    const watcher = watchAccess({
      check: async () => { calls++; throw new Error("x"); },
      onReady: () => {},
      onError: () => {},
      schedule: (fn) => { timers.push(fn); return timers.length; },
      cancelSchedule: () => {},
    });
    await flush();
    watcher.retryNow();
    await flush();
    assert.equal(calls, 2);
    watcher.cancel();
    watcher.retryNow();
    await flush();
    assert.equal(calls, 2);
  });
});

describe("createLatestGuard", () => {
  it("discards results from superseded runs", () => {
    const guard = createLatestGuard();
    const first = guard.begin();
    const second = guard.begin();
    assert.equal(first(), false);
    assert.equal(second(), true);
    guard.invalidate();
    assert.equal(second(), false);
  });
});

describe("readLoad", () => {
  it("is not ready for a different key or before the first snapshot", () => {
    assert.equal(readLoad({ key: "a", data: [1], loaded: true, error: null }, "b", []).ready, false);
    assert.deepEqual(readLoad({ key: "a", data: [1], loaded: true, error: null }, "b", []).data, []);
    assert.equal(readLoad(null, "a", []).ready, false);
    assert.equal(readLoad({ key: "a", data: null, loaded: false, error: null }, "a", []).ready, false);
  });
  it("is ready for matching loaded key and reports errors as not ready", () => {
    assert.equal(readLoad({ key: "a", data: [], loaded: true, error: null }, "a", []).ready, true);
    const err = new Error("denied");
    const r = readLoad({ key: "a", data: [1], loaded: true, error: err }, "a", []);
    assert.equal(r.ready, false);
    assert.equal(r.error, err);
  });
});

describe("subscribeWithRetry", () => {
  it("resubscribes after a listener error and stops on unsubscribe", async () => {
    const { subscribeWithRetry } = await import("../src/utils/loadReliability.js");
    const subs = [];
    const timers = [];
    const seen = [];
    const errors = [];
    const stop = subscribeWithRetry(
      (next, err) => {
        const sub = { next, err, closed: false };
        subs.push(sub);
        return () => { sub.closed = true; };
      },
      {
        onNext: (v) => seen.push(v),
        onError: (e) => errors.push(e.message),
        schedule: (fn, ms) => { timers.push({ fn, ms }); return timers.length; },
        cancelSchedule: () => {},
      }
    );
    subs[0].next("a");
    subs[0].err(new Error("boom"));
    assert.equal(subs[0].closed, true);
    assert.deepEqual(errors, ["boom"]);
    assert.equal(subs.length, 1);
    timers[0].fn();
    assert.equal(subs.length, 2);
    subs[1].next("b");
    assert.deepEqual(seen, ["a", "b"]);
    stop();
    assert.equal(subs[1].closed, true);
    subs[1].next("late");
    assert.deepEqual(seen, ["a", "b"]);
  });

  it("does not resubscribe after unsubscribe during backoff", () => {
    return import("../src/utils/loadReliability.js").then(({ subscribeWithRetry }) => {
      const subs = [];
      let pending;
      const stop = subscribeWithRetry(
        (next, err) => { subs.push(err); return () => {}; },
        { onNext() {}, schedule: (fn) => { pending = fn; return 1; }, cancelSchedule: () => {} }
      );
      subs[0](new Error("x"));
      stop();
      pending();
      assert.equal(subs.length, 1);
    });
  });
});

describe("listener error then recovery (pool/settings pattern)", () => {
  it("reports an error, then clears it when the resubscribed listener delivers", async () => {
    const { subscribeWithRetry } = await import("../src/utils/loadReliability.js");
    let state = { error: null, ready: false };
    const subs = [];
    let retry;
    subscribeWithRetry(
      (next, err) => { subs.push({ next, err }); return () => {}; },
      {
        onNext: () => { state = { error: null, ready: true }; },
        onError: (error) => { state = { error, ready: false }; },
        schedule: (fn) => { retry = fn; return 1; },
        cancelSchedule: () => {},
      }
    );
    subs[0].err(new Error("permission-denied"));
    assert.equal(state.ready, false);
    assert.equal(state.error.message, "permission-denied");
    retry();
    subs[1].next({});
    assert.deepEqual(state, { error: null, ready: true });
  });
});

describe("permanent listener errors", () => {
  it("classifies firestore error codes", async () => {
    const { isPermanentError } = await import("../src/utils/loadReliability.js");
    assert.equal(isPermanentError({ code: "permission-denied" }), true);
    assert.equal(isPermanentError({ code: "firestore/failed-precondition" }), true);
    assert.equal(isPermanentError({ code: "unavailable" }), false);
    assert.equal(isPermanentError(new Error("x")), false);
    assert.equal(isPermanentError(null), false);
  });

  it("does not auto-retry permission-denied but resubscribes on explicit retry", async () => {
    const { subscribeWithRetry } = await import("../src/utils/loadReliability.js");
    const subs = [];
    const timers = [];
    const stop = subscribeWithRetry(
      (next, err) => { subs.push({ next, err }); return () => {}; },
      {
        onNext() {},
        schedule: (fn) => { timers.push(fn); return timers.length; },
        cancelSchedule: () => {},
      }
    );
    stop.retry();
    assert.equal(subs.length, 1);
    subs[0].err(Object.assign(new Error("denied"), { code: "permission-denied" }));
    assert.equal(timers.length, 0);
    stop.retry();
    assert.equal(subs.length, 2);
    stop();
    stop.retry();
    assert.equal(subs.length, 2);
  });

  it("explicit retry supersedes a pending automatic retry", async () => {
    const { subscribeWithRetry } = await import("../src/utils/loadReliability.js");
    const subs = [];
    let pending = null;
    const stop = subscribeWithRetry(
      (next, err) => { subs.push(err); return () => {}; },
      {
        onNext() {},
        schedule: (fn) => { pending = fn; return 1; },
        cancelSchedule: () => { pending = null; },
      }
    );
    subs[0](Object.assign(new Error("down"), { code: "unavailable" }));
    assert.ok(pending);
    stop.retry();
    assert.equal(subs.length, 2);
    assert.equal(pending, null);
  });
});
