import { normalizeGameTags } from "./gameTags.js";

export function getHiddenTagSet(settings) {
  return new Set(normalizeGameTags(settings?.hiddenTags));
}

export function isGameHiddenByTags(game, hiddenTagSet) {
  if (!hiddenTagSet || hiddenTagSet.size === 0) return false;
  return normalizeGameTags(game?.tags).some((tag) => hiddenTagSet.has(tag));
}

/**
 * Build a NEW voting candidate snapshot. Pool and submission records are never
 * modified; ineligible ids are only left out of the snapshot.
 *
 * `eligibleGames` must be the owned, catalog-resolved group games. Callers must
 * report whether catalog/group refs and settings are loaded so a transient
 * empty state cannot produce an invalid (or tag-bypassing) candidate list.
 */
export function buildVotingCandidates({
  poolActiveIds = [],
  submittedIds = [],
  eligibleGames = [],
  hiddenTags,
  ready = false,
}) {
  if (!ready || !hiddenTags) {
    return { ok: false, reason: "NOT_READY", candidates: [], excluded: [] };
  }
  const hidden = hiddenTags instanceof Set ? hiddenTags : getHiddenTagSet({ hiddenTags });
  const gameMap = new Map((eligibleGames || []).map((g) => [g.id, g]));
  const candidates = [];
  const excluded = [];

  for (const id of new Set([...poolActiveIds, ...submittedIds])) {
    const game = gameMap.get(id);
    if (!game) excluded.push({ id, reason: "UNAVAILABLE" });
    else if (isGameHiddenByTags(game, hidden)) excluded.push({ id, reason: "HIDDEN_TAG" });
    else candidates.push(id);
  }

  if (candidates.length === 0) {
    return { ok: false, reason: "NO_CANDIDATES", candidates, excluded };
  }
  return { ok: true, reason: null, candidates, excluded };
}
