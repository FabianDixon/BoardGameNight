// Pure helpers for access gating and snapshot loading state (no Firebase imports).

export function createLatestGuard() {
  let current = 0;
  return {
    begin() {
      const token = ++current;
      return () => token === current;
    },
    invalidate() {
      current++;
    },
  };
}

// Repeatedly confirms access until it succeeds or is cancelled. Failures are
// surfaced via onError and retried with capped exponential backoff.
export function watchAccess({
  check,
  onChecking = () => {},
  onReady,
  onError,
  baseDelayMs = 1000,
  maxDelayMs = 15000,
  schedule = setTimeout,
  cancelSchedule = clearTimeout,
}) {
  let cancelled = false;
  let timer = null;
  let running = false;
  let failures = 0;

  async function attempt() {
    if (cancelled || running) return;
    running = true;
    if (timer != null) {
      cancelSchedule(timer);
      timer = null;
    }
    onChecking();
    try {
      await check();
      running = false;
      if (!cancelled) onReady();
    } catch (error) {
      running = false;
      if (cancelled) return;
      failures++;
      onError(error, failures);
      const delay = Math.min(maxDelayMs, baseDelayMs * 2 ** (failures - 1));
      timer = schedule(() => {
        timer = null;
        attempt();
      }, delay);
    }
  }

  attempt();

  return {
    retryNow() {
      attempt();
    },
    cancel() {
      cancelled = true;
      if (timer != null) cancelSchedule(timer);
      timer = null;
    },
  };
}

export const EMPTY_LOAD = Object.freeze({ key: null, data: null, loaded: false, error: null });

// Snapshot state is tagged with the key it was loaded for; results belonging to a
// different key (previous user/group) are treated as not loaded.
export function readLoad(state, key, fallback) {
  if (!key || !state || state.key !== key) {
    return { data: fallback, ready: false, error: null };
  }
  return {
    data: state.loaded ? state.data : fallback,
    ready: state.loaded && !state.error,
    error: state.error,
  };
}

const PERMANENT_CODES = new Set([
  "permission-denied",
  "unauthenticated",
  "failed-precondition",
  "invalid-argument",
  "not-found",
  "unimplemented",
]);

// Errors that retrying cannot fix without a change in access, data or deployment.
export function isPermanentError(error) {
  const code = String(error?.code || "").replace(/^firestore\//, "");
  return PERMANENT_CODES.has(code);
}

// Firestore listeners are terminated by an error, so recovery needs a fresh
// subscription. `subscribe(onNext, onError)` must return an unsubscribe function.
// Transient errors resubscribe automatically; permanent ones wait for retry().
// The returned stop function also exposes retry() for explicit user recovery.
export function subscribeWithRetry(subscribe, {
  onNext,
  onError = () => {},
  retryDelayMs = 5000,
  shouldRetry = (error) => !isPermanentError(error),
  schedule = setTimeout,
  cancelSchedule = clearTimeout,
}) {
  let stopped = false;
  let unsub = null;
  let timer = null;

  function start() {
    timer = null;
    if (stopped || unsub) return;
    unsub = subscribe(
      (value) => {
        if (!stopped) onNext(value);
      },
      (error) => {
        if (stopped) return;
        if (unsub) unsub();
        unsub = null;
        onError(error);
        if (shouldRetry(error)) timer = schedule(start, retryDelayMs);
      }
    );
  }

  start();

  function stop() {
    stopped = true;
    if (timer != null) cancelSchedule(timer);
    timer = null;
    if (unsub) unsub();
    unsub = null;
  }

  stop.retry = () => {
    if (stopped || unsub) return;
    if (timer != null) cancelSchedule(timer);
    start();
  };

  return stop;
}
