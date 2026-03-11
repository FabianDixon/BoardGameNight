export const SUGGESTED_GAME_TAGS = [
  "co-op",
  "competitive",
  "party",
  "deck-building",
  "engine-building",
  "worker-placement",
  "drafting",
  "area-control",
  "two-player",
  "campaign",
  "light",
  "medium",
  "heavy",
  "short",
  "long",
];

const TAG_ALIAS_MAP = {
  coop: "co-op",
  "co op": "co-op",
  cooperative: "co-op",
  "deckbuilding": "deck-building",
  "deck building": "deck-building",
  "engine building": "engine-building",
  "worker placement": "worker-placement",
  "worker-placement": "worker-placement",
  "area control": "area-control",
  "area-control": "area-control",
  "2 player": "two-player",
  "2-player": "two-player",
  "two player": "two-player",
};

const TAG_DISPLAY_LABELS = {
  "co-op": "Co-op",
  competitive: "Competitive",
  party: "Party",
  "deck-building": "Deck-building",
  "engine-building": "Engine-building",
  "worker-placement": "Worker placement",
  drafting: "Drafting",
  "area-control": "Area control",
  "two-player": "Two-player",
  campaign: "Campaign",
  light: "Light",
  medium: "Medium",
  heavy: "Heavy",
  short: "Short",
  long: "Long",
};

function normalizeTagKey(value) {
  return String(value || "")
    .trim()
    .toLowerCase()
    .replace(/[’']/g, "")
    .replace(/&/g, " and ")
    .replace(/[\/]+/g, " ")
    .replace(/[^a-z0-9\s-]+/g, " ")
    .replace(/[-_]+/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function normalizeGameTag(tag) {
  const normalizedKey = normalizeTagKey(tag);
  if (!normalizedKey) return "";

  const canonical = TAG_ALIAS_MAP[normalizedKey] || normalizedKey.replace(/\s+/g, "-");
  return canonical.replace(/-+/g, "-").trim();
}

export function normalizeGameTags(tags) {
  const rawTags = Array.isArray(tags) ? tags : [];
  const normalized = [];

  for (const tag of rawTags) {
    const canonical = normalizeGameTag(tag);
    if (!canonical || normalized.includes(canonical)) continue;
    normalized.push(canonical);
  }

  return normalized;
}

export function getGameTagLabel(tag) {
  const canonical = normalizeGameTag(tag);
  if (!canonical) return "";
  if (TAG_DISPLAY_LABELS[canonical]) return TAG_DISPLAY_LABELS[canonical];

  return canonical
    .split("-")
    .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
    .join(" ");
}

export function getUniqueTagsFromGames(games) {
  const tags = new Set();
  for (const game of games || []) {
    const normalized = normalizeGameTags(game.tags);
    for (const tag of normalized) {
      tags.add(tag);
    }
  }
  return Array.from(tags).sort();
}
