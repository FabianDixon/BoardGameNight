// src/weights/weighting.js

export const DEFAULT_WEIGHTS = {
    // bonus for being unplayed by the group (playedCount == 0)
    wNewGame: 1.0,
  
    // bonus per session since cycleStartedSession
    wAgeSessions: 0.15,
  
    // bonus for historic votes during current pool cycle (log scaled)
    wCycleVotes: 0.20,
  
    // penalty if the game won recently (in sessions)
    wRecentWinPenalty: 0.60,
    recentWinSessions: 3,
  
    // clamp multiplier to avoid extreme outcomes
    minMultiplier: 0.10,
    maxMultiplier: 3.00,
  };
  
  function clamp(x, lo, hi) {
    return Math.max(lo, Math.min(hi, x));
  }
  
  /**
   * Returns a multiplier (>= minMultiplier) to apply to sessionVotes.
   * effectiveScore = sessionVotes * multiplier
   *
   * ctx: { now, sessionIndex }
   */
  export function computeVoteMultiplier(poolDoc, ctx, weights = DEFAULT_WEIGHTS) {
    const p = poolDoc || {};
    const { sessionIndex = 0 } = ctx || {};
  
    const playedCount = Number(p.playedCount || 0);
    const playedOverride = Boolean(p.playedOverride);
    const isNew = playedCount === 0 && !playedOverride;
  
    const cycleStartedSession = Number(p.cycleStartedSession ?? sessionIndex);
    const ageSessions = Math.max(0, sessionIndex - cycleStartedSession);
  
    const cycleVoteCount = Number(p.cycleVoteCount || 0);
    const cycleVotesTerm = Math.max(0, cycleVoteCount);
  
    const lastWonSession = Number(p.lastWonSession ?? -1);
    const recentlyWon =
      lastWonSession >= 0 && (sessionIndex - lastWonSession) < weights.recentWinSessions;
  
    const bonus =
      (isNew ? weights.wNewGame : 0) +
      weights.wAgeSessions * ageSessions +
      weights.wCycleVotes * cycleVotesTerm;
  
    const penalty = recentlyWon ? weights.wRecentWinPenalty : 0;
  
    const multiplier = 1 + bonus - penalty;
    return clamp(multiplier, weights.minMultiplier, weights.maxMultiplier);
  }
  
  /**
   * Picks a winner among ONLY games with sessionVotes > 0.
   * Returns { winnerGameId, scoreBreakdown, weightsUsed }.
   *
   * @param {Map<string, number>} voteCounts - gameId -> votes in this session
   * @param {Map<string, object>} poolMap - gameId -> pool doc data
   */
  export function pickWeightedWinner({
    voteCounts,
    poolMap,
    now,
    sessionIndex,
    weights = DEFAULT_WEIGHTS,
  }) {
    const votedEntries = [...voteCounts.entries()].filter(([, c]) => c > 0);
  
    if (votedEntries.length === 0) {
      return {
        winnerGameId: null,
        scoreBreakdown: [],
        weightsUsed: weights,
      };
    }
  
    const ctx = { now, sessionIndex };
  
    const scoreBreakdown = votedEntries
      .map(([gameId, sessionVotes]) => {
        const p = poolMap.get(gameId);
        const multiplier = computeVoteMultiplier(p, ctx, weights);
        const effectiveScore = sessionVotes * multiplier;
  
        return {
          gameId,
          sessionVotes,
          multiplier: Number(multiplier.toFixed(4)),
          effectiveScore: Number(effectiveScore.toFixed(4)),
          // debug
          cycleVoteCount: Number(p?.cycleVoteCount || 0),
          playedCount: Number(p?.playedCount || 0),
          cycleStartedSession: Number(p?.cycleStartedSession ?? sessionIndex),
          lastWonSession: Number(p?.lastWonSession ?? -1),
        };
      })
      .sort((a, b) => {
        if (b.effectiveScore !== a.effectiveScore) return b.effectiveScore - a.effectiveScore;
        if (b.sessionVotes !== a.sessionVotes) return b.sessionVotes - a.sessionVotes;
        return a.cycleStartedSession - b.cycleStartedSession; // older in pool wins ties
      });
  
    return {
      winnerGameId: scoreBreakdown[0]?.gameId || null,
      scoreBreakdown,
      weightsUsed: weights,
    };
  }