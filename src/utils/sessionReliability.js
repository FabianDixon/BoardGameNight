import { collection, doc, getDocFromServer, increment, runTransaction } from "firebase/firestore";
import { VOTE_STATUS } from "../constants/workflow.js";

export function resolveEffectiveWinnerId(play) {
  if (Array.isArray(play?.overrideResults) && play.overrideResults.length > 0) {
    const overrideWinner = play.overrideResults.find(
      (row) => row.isWinner === true && String(row.gameId || "").trim()
    );
    if (overrideWinner) return String(overrideWinner.gameId).trim();
  }
  return typeof play?.winnerGameId === "string" && play.winnerGameId.trim()
    ? play.winnerGameId.trim()
    : null;
}

function putWinnerFirst(overrideResults, winnerGameId) {
  if (!winnerGameId || !Array.isArray(overrideResults)) return overrideResults;
  const winnerIndex = overrideResults.findIndex((row) =>
    row?.isWinner === true
    && typeof row.gameId === "string"
    && row.gameId.trim() === winnerGameId
  );
  if (winnerIndex < 0) return overrideResults;
  const winner = { ...overrideResults[winnerIndex], gameId: winnerGameId };
  if (winnerIndex === 0 && overrideResults[0].gameId === winnerGameId) return overrideResults;
  return [winner, ...overrideResults.slice(0, winnerIndex), ...overrideResults.slice(winnerIndex + 1)];
}

async function assertHistoricalRestoreIsVerifiable(tx, db, groupId, play, previousWinnerId, nextWinnerId, overrideResults) {
  if (!previousWinnerId || previousWinnerId === nextWinnerId) return true;
  const poolRef = doc(db, "groups", groupId, "pool", previousWinnerId);
  const poolSnap = await tx.get(poolRef);
  if (!poolSnap.exists() || poolSnap.data()?.isActive !== false) return true;

  const lastWonSession = poolSnap.data()?.lastWonSession;
  if (typeof play.sessionIndex !== "number" || typeof lastWonSession !== "number") {
    throw new Error(
      "Cannot restore this previous winner because its session history cannot be verified."
    );
  }

  const [gameSnap, settingsSnap] = await Promise.all([
    tx.get(doc(db, "games", previousWinnerId)),
    tx.get(doc(db, "groups", groupId, "settings", "meta")),
  ]);
  const tags = gameSnap.data()?.tags;
  const hiddenTags = settingsSnap.data()?.hiddenTags;
  const hidden = !gameSnap.exists()
    || (settingsSnap.exists()
      && (!Array.isArray(hiddenTags)
        || (tags != null && !Array.isArray(tags))
        || (Array.isArray(hiddenTags) && Array.isArray(tags)
          && tags.some((tag) => hiddenTags.includes(tag)))));
  if (lastWonSession > play.sessionIndex) {
    if (!hidden) return false;
    throw new Error(
      "Cannot restore this hidden or missing previous winner because it was won again in a later session."
    );
  }
  if (lastWonSession !== play.sessionIndex) {
    throw new Error(
      "Cannot restore this previous winner because its last-won session does not match the play."
    );
  }
  if (!hidden) return true;

  const hasResultRows = Array.isArray(overrideResults) && overrideResults.length > 0;
  if (!nextWinnerId && hasResultRows) {
    throw new Error(
      "Cannot save a no-winner correction with result rows while its hidden or missing previous winner cannot be safely restored."
    );
  }
  return true;
}

export async function createSession(db, groupId, userId, now) {
  const voteRef = doc(collection(db, "groups", groupId, "votes"));
  const metaRef = doc(db, "groups", groupId, "activeSession", "meta");

  // Recover metadata left behind by the former non-atomic close before starting.
  await runTransaction(db, async (tx) => {
    const metaSnap = await tx.get(metaRef);
    const meta = metaSnap.exists() ? metaSnap.data() : null;
    if (!meta?.activeVoteId || ![VOTE_STATUS.OPEN, VOTE_STATUS.COLLECTING].includes(meta.status)) return;
    const previousVote = await tx.get(doc(db, "groups", groupId, "votes", meta.activeVoteId));
    if (!previousVote.exists() || previousVote.data().status !== VOTE_STATUS.CLOSED) return;
    tx.update(metaRef, {
      status: null,
      activeVoteId: null,
      sessionIndex: increment(1),
      updatedAt: now,
    });
  });

  await runTransaction(db, async (tx) => {
    const metaSnap = await tx.get(metaRef);
    const meta = metaSnap.exists() ? metaSnap.data() : null;
    if (meta?.status != null || meta?.activeVoteId != null) {
      throw new Error("SESSION_ALREADY_ACTIVE");
    }

    tx.set(voteRef, {
      status: VOTE_STATUS.COLLECTING,
      createdAt: now,
      createdBy: userId,
    });
    tx.set(metaRef, {
      activeVoteId: voteRef.id,
      ownerId: userId,
      status: VOTE_STATUS.COLLECTING,
      sessionIndex: Number(meta?.sessionIndex || 0),
      updatedAt: now,
    }, { merge: true });
  });
  return voteRef.id;
}

export async function openSession(db, groupId, voteId, candidates, now) {
  const voteRef = doc(db, "groups", groupId, "votes", voteId);
  const metaRef = doc(db, "groups", groupId, "activeSession", "meta");
  return runTransaction(db, async (tx) => {
    const [voteSnap, metaSnap] = await Promise.all([tx.get(voteRef), tx.get(metaRef)]);
    if (!voteSnap.exists() || voteSnap.data().status !== VOTE_STATUS.COLLECTING) return false;
    const meta = metaSnap.exists() ? metaSnap.data() : null;
    if (meta?.status !== VOTE_STATUS.COLLECTING || meta.activeVoteId !== voteId) {
      throw new Error("SESSION_METADATA_MISMATCH");
    }
    tx.update(voteRef, { status: VOTE_STATUS.OPEN, openedAt: now, candidates });
    tx.update(metaRef, { status: VOTE_STATUS.OPEN, updatedAt: now });
    return true;
  });
}

export async function closeSession(db, groupId, voteId, now, prepareResult) {
  const voteRef = doc(db, "groups", groupId, "votes", voteId);
  const metaRef = doc(db, "groups", groupId, "activeSession", "meta");
  try {
    return await runTransaction(db, async (tx) => {
      const [voteSnap, metaSnap] = await Promise.all([tx.get(voteRef), tx.get(metaRef)]);
      if (!voteSnap.exists() || voteSnap.data().status !== VOTE_STATUS.OPEN) return null;
      const meta = metaSnap.exists() ? metaSnap.data() : null;
      if (meta?.status !== VOTE_STATUS.OPEN || meta.activeVoteId !== voteId) {
        throw new Error("SESSION_METADATA_MISMATCH");
      }

      const sessionIndex = Number(meta.sessionIndex || 0);
      const { winnerGameId, scoreBreakdown, weightsUsed, playRecord } = await prepareResult(sessionIndex);
      tx.update(voteRef, {
        status: VOTE_STATUS.CLOSED,
        closedAt: now,
        winnerGameId,
        scoreBreakdown,
        weightsUsed,
      });

      const updates = new Map();
      for (const { gameId, sessionVotes } of scoreBreakdown) {
        updates.set(gameId, {
          lastVotedAt: now,
          cycleVoteCount: increment(sessionVotes),
          lifetimeVoteCount: increment(sessionVotes),
        });
      }
      if (winnerGameId) {
        updates.set(winnerGameId, {
          ...updates.get(winnerGameId),
          isActive: false,
          lastWonAt: now,
          lastWonSession: sessionIndex,
          playedCount: increment(1),
          lastPlayedAt: now,
        });
      }
      for (const [gameId, update] of updates) {
        tx.set(doc(db, "groups", groupId, "pool", gameId), update, { merge: true });
      }
      tx.set(doc(db, "groups", groupId, "plays", voteId), playRecord, { merge: true });
      tx.update(metaRef, {
        status: null,
        activeVoteId: null,
        sessionIndex: increment(1),
        updatedAt: now,
      });
      return { winnerGameId, scoreBreakdown, weightsUsed };
    });
  } catch (error) {
    // Rules can reject the losing concurrent commit before Firestore reports a conflict.
    if (error?.code === "permission-denied") {
      try {
        const latest = await getDocFromServer(voteRef);
        if (latest.exists() && latest.data().status === VOTE_STATUS.CLOSED) return null;
      } catch {
        // Preserve the original transaction error if the verification read fails.
      }
    }
    throw error;
  }
}

export async function saveSessionOverride(db, {
  groupId, voteId, userId, now, winnerGameId, overrideResults,
}) {
  const playRef = doc(db, "groups", groupId, "plays", voteId);
  const normalizedWinnerGameId = typeof winnerGameId === "string" && winnerGameId.trim()
    ? winnerGameId.trim()
    : null;
  const orderedOverrideResults = putWinnerFirst(overrideResults, normalizedWinnerGameId);
  // Align legacy top-level data with the already-effective winner so rules can
  // verify the restoration without trusting a client-supplied winner.
  await runTransaction(db, async (tx) => {
    const playSnap = await tx.get(playRef);
    if (!playSnap.exists()) {
      throw new Error("Cannot override session results because the history record is missing.");
    }
    const play = playSnap.data();
    const effectiveWinner = resolveEffectiveWinnerId(play);
    await assertHistoricalRestoreIsVerifiable(
      tx, db, groupId, play, effectiveWinner, normalizedWinnerGameId, orderedOverrideResults
    );
    if ((play.winnerGameId ?? null) !== effectiveWinner) {
      tx.update(playRef, {
        winnerGameId: effectiveWinner,
        createdAt: typeof play.createdAt === "number" ? play.createdAt : now,
        createdBy: play.createdBy || userId,
        updatedAt: typeof play.updatedAt === "number" ? play.updatedAt : now,
      });
    }
  });

  await runTransaction(db, async (tx) => {
    const playSnap = await tx.get(playRef);
    const currentPlay = playSnap.exists() ? playSnap.data() : null;
    if (!currentPlay) {
      throw new Error("Cannot override session results because the history record is missing.");
    }
    const previousWinnerId = resolveEffectiveWinnerId(currentPlay);
    if ((currentPlay.winnerGameId ?? null) !== previousWinnerId) {
      throw new Error("SESSION_RESULTS_CHANGED");
    }
    const shouldRestorePreviousPool = await assertHistoricalRestoreIsVerifiable(
      tx, db, groupId, currentPlay, previousWinnerId, normalizedWinnerGameId, orderedOverrideResults
    );
    let previousPoolRef = null;
    let previousPoolSnap = null;
    if (previousWinnerId && previousWinnerId !== normalizedWinnerGameId) {
      previousPoolRef = doc(db, "groups", groupId, "pool", previousWinnerId);
      previousPoolSnap = await tx.get(previousPoolRef);
    }

    tx.set(playRef, {
      groupId,
      voteId,
      overrideResults: Array.isArray(orderedOverrideResults) ? orderedOverrideResults : [],
      winnerGameId: normalizedWinnerGameId,
      createdAt: typeof currentPlay?.createdAt === "number" ? currentPlay.createdAt : now,
      updatedAt: now,
      createdBy: currentPlay?.createdBy || userId,
    }, { merge: true });

    if (previousWinnerId !== normalizedWinnerGameId) {
      if (shouldRestorePreviousPool && previousPoolSnap?.exists() && previousPoolSnap.data()?.isActive === false) {
        const restore = { isActive: true };
        if (typeof previousPoolSnap.data().lastWonSession === "number"
          && (normalizedWinnerGameId || !orderedOverrideResults?.length)) {
          restore.restorationVoteId = voteId;
        }
        tx.set(previousPoolRef, restore, { merge: true });
      }
      if (normalizedWinnerGameId) {
        tx.set(doc(db, "groups", groupId, "pool", normalizedWinnerGameId), { isActive: false }, { merge: true });
      }
    }
  });
}

export function createAutoCloseGuard(onRetry, {
  delay = 5000,
  schedule = setTimeout,
  cancel = clearTimeout,
  onError = (error) => console.error("Auto closeVote failed:", error),
} = {}) {
  let attempt = null;

  return {
    run(key, close) {
      if (attempt?.key === key) return;
      const current = { key, timer: null };
      attempt = current;
      Promise.resolve().then(() => {
        if (attempt === current) return close();
      }).then((result) => {
        if (result === false && attempt === current) attempt = null;
      }).catch((error) => {
        onError(error);
        if (attempt !== current) return;
        current.timer = schedule(() => {
          if (attempt !== current) return;
          attempt = null;
          onRetry();
        }, delay);
      });
    },
    reset() {
      if (attempt?.timer != null) cancel(attempt.timer);
      attempt = null;
    },
  };
}
