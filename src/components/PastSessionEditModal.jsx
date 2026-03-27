// src/components/PastSessionEditModal.jsx
//
// Edit form for a past session play record.
// Allows changing: played date, selected/winner game, additional games,
// result mode, and placements.
//
// Mirrors the "Record session details" patterns in VotingPanel so the UX
// is consistent. Helper functions are copied from App.jsx / VotingPanel.jsx —
// they can be extracted to a shared utils file later if desired.

import { useMemo, useState } from "react";
import {
  DEFAULT_AVATAR_ID,
  avatarById,
  avatarIconById,
  isValidAvatarId,
} from "../constants/avatars";

// ---------- local helpers (mirrored from VotingPanel / App) ----------

const SESSION_RESULT_MODE_OPTIONS = [
  { value: "ranked", label: "Ranked" },
  { value: "coop-win", label: "Co-op win" },
  { value: "coop-loss", label: "Co-op loss" },
  { value: "no-winner", label: "No winner" },
];

const SESSION_RESULT_MODE_SET = new Set(
  SESSION_RESULT_MODE_OPTIONS.map((o) => o.value)
);

function defaultResultMode(winnerGameId) {
  return winnerGameId ? "ranked" : "no-winner";
}

function normalizeResultMode(value, fallback) {
  return SESSION_RESULT_MODE_SET.has(value) ? value : fallback;
}

function normalizePlayedGameIds(playedGameIds, winnerGameId) {
  const winnerId =
    typeof winnerGameId === "string" && winnerGameId.trim()
      ? winnerGameId.trim()
      : null;

  const uniqueIds = [];
  for (const value of Array.isArray(playedGameIds) ? playedGameIds : []) {
    const id = String(value || "").trim();
    if (!id || uniqueIds.includes(id)) continue;
    uniqueIds.push(id);
  }

  if (!winnerId) return uniqueIds;
  return [winnerId, ...uniqueIds.filter((id) => id !== winnerId)];
}

function normalizePlacements(placements, resultMode) {
  const mode = normalizeResultMode(resultMode, "no-winner");
  if (mode === "coop-loss" || mode === "no-winner") return [];

  const deduped = new Map();
  for (const entry of Array.isArray(placements) ? placements : []) {
    const userId = String(entry?.userId || "").trim();
    if (!userId) continue;
    const placeValue = Number(entry?.place);
    if (!Number.isFinite(placeValue) || placeValue < 1) continue;
    deduped.set(userId, {
      userId,
      place: mode === "coop-win" ? 1 : Math.floor(placeValue),
    });
  }

  return [...deduped.values()].sort((a, b) => {
    if (a.place !== b.place) return a.place - b.place;
    return a.userId.localeCompare(b.userId);
  });
}

function normalizeParticipantIds(participantIds, fallbackMemberIds = []) {
  const unique = [];

  for (const value of Array.isArray(participantIds) ? participantIds : []) {
    const userId = String(value || "").trim();
    if (!userId || unique.includes(userId)) continue;
    unique.push(userId);
  }

  if (unique.length > 0) return unique;

  const fallback = [];
  for (const value of Array.isArray(fallbackMemberIds) ? fallbackMemberIds : []) {
    const userId = String(value || "").trim();
    if (!userId || fallback.includes(userId)) continue;
    fallback.push(userId);
  }

  return fallback;
}

function normalizeParticipantPlacements(placements, resultMode, participantIds) {
  const normalized = normalizePlacements(placements, resultMode);
  const allowed = new Set(normalizeParticipantIds(participantIds));
  if (!allowed.size) return normalized;
  return normalized.filter((entry) => allowed.has(entry.userId));
}

function normalizeSessionMetrics(metrics) {
  const normalized = [];

  for (const entry of Array.isArray(metrics) ? metrics : []) {
    const name = String(entry?.name || "").trim();
    const value = Number(entry?.value);
    if (!name || !Number.isFinite(value)) continue;
    normalized.push({ name, value });
  }

  return normalized;
}

function formatPlaceLabel(place) {
  const x = Number(place);
  if (!Number.isFinite(x) || x < 1) return "—";
  const abs = Math.abs(Math.trunc(x));
  const mod100 = abs % 100;
  if (mod100 >= 11 && mod100 <= 13) return `${abs}th`;
  switch (abs % 10) {
    case 1:
      return `${abs}st`;
    case 2:
      return `${abs}nd`;
    case 3:
      return `${abs}rd`;
    default:
      return `${abs}th`;
  }
}

function toDateInputValue(timestamp) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return "";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "";
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const day = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${day}`;
}

function fromDateInputValue(value) {
  const v = String(value || "").trim();
  if (!v) return null;
  const t = new Date(`${v}T12:00:00`).getTime();
  return Number.isFinite(t) ? t : null;
}

function memberDisplayName(member, fallbackUserId = "") {
  const nickname = String(member?.nickname || "").trim();
  if (nickname) return nickname;
  if (member) return "Unnamed member";
  const value = String(fallbackUserId || "").trim();
  if (!value) return "Unknown member";
  return value.length <= 12 ? value : `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function resolveAvatar(avatarId) {
  return (
    avatarById(avatarId) ||
    avatarById(DEFAULT_AVATAR_ID) ||
    { label: "Avatar", icon: avatarIconById(DEFAULT_AVATAR_ID), src: null }
  );
}

// ---------- component ----------

export default function PastSessionEditModal({
  play,
  groupGames,
  members,
  participantSummaryById = {},
  onSearchAccounts,
  onToast,
  isSaving,
  onSave,
  onClose,
}) {
  // --- initial values from the play record ---
  const initialWinnerGameId =
    typeof play?.winnerGameId === "string" && play.winnerGameId.trim()
      ? play.winnerGameId.trim()
      : "";

  const initialResultMode = normalizeResultMode(
    play?.resultMode,
    defaultResultMode(initialWinnerGameId || null)
  );

  const groupMemberIds = useMemo(() => {
    return (members || [])
      .map((member) => String(member?.userId || "").trim())
      .filter(Boolean);
  }, [members]);

  const initialParticipantIds = normalizeParticipantIds(play?.participantIds, groupMemberIds);

  const [winnerGameId, setWinnerGameId] = useState(initialWinnerGameId);
  const [playedDate, setPlayedDate] = useState(toDateInputValue(play?.playedAt));
  const [playedGameIds, setPlayedGameIds] = useState(
    normalizePlayedGameIds(play?.playedGameIds, initialWinnerGameId)
  );
  const [resultMode, setResultMode] = useState(initialResultMode);
  const [participantIds, setParticipantIds] = useState(initialParticipantIds);
  const [placements, setPlacements] = useState(
    normalizeParticipantPlacements(play?.placements, initialResultMode, initialParticipantIds)
  );
  const [metrics, setMetrics] = useState(
    normalizeSessionMetrics(play?.metrics).map((entry) => ({
      name: entry.name,
      value: String(entry.value),
    }))
  );
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");
  const [participantSearchResults, setParticipantSearchResults] = useState([]);
  const [isSearchingParticipants, setIsSearchingParticipants] = useState(false);

  const sortedGames = useMemo(
    () =>
      [...(groupGames || [])].sort((a, b) =>
        (a.title || "").localeCompare(b.title || "")
      ),
    [groupGames]
  );

  const memberOptions = useMemo(() => {
    return [...(members || [])]
      .filter((member) => String(member?.userId || "").trim())
      .sort((a, b) => memberDisplayName(a).localeCompare(memberDisplayName(b)));
  }, [members]);

  const participantOptions = useMemo(() => {
    return normalizeParticipantIds(participantIds, groupMemberIds)
      .map((userId) => {
        const member = (members || []).find((m) => String(m?.userId || "").trim() === userId);
        const summary = participantSummaryById?.[userId] || null;
        const label = summary?.label || memberDisplayName(member, userId);
        const avatarId = isValidAvatarId(summary?.avatarId)
          ? summary.avatarId
          : isValidAvatarId(member?.avatarId)
          ? member.avatarId
          : DEFAULT_AVATAR_ID;
        return {
          userId,
          label,
          avatarId,
          isMember: !!member,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [participantIds, groupMemberIds, members, participantSummaryById]);

  const addableMemberOptions = useMemo(() => {
    const selected = new Set(normalizeParticipantIds(participantIds, groupMemberIds));
    return memberOptions
      .filter((member) => !selected.has(String(member.userId || "").trim()))
      .map((member) => ({
        userId: String(member.userId || "").trim(),
        label: memberDisplayName(member, member.userId),
      }));
  }, [memberOptions, participantIds, groupMemberIds]);

  const placementChoices = useMemo(
    () =>
      Array.from({ length: Math.max(participantOptions.length, 4) }, (_, i) => i + 1),
    [participantOptions.length]
  );

  // When the winner changes, keep all other played games but reorder so the
  // new winner is at front. The old winner naturally becomes an additional game.
  function handleWinnerChange(nextId) {
    const id = String(nextId || "").trim();
    setWinnerGameId(id);
    setPlayedGameIds((prev) => normalizePlayedGameIds(prev, id || null));
  }

  function handleResultModeChange(nextMode) {
    const normalized = normalizeResultMode(
      nextMode,
      defaultResultMode(winnerGameId || null)
    );
    setResultMode(normalized);
    setPlacements((prev) =>
      normalizeParticipantPlacements(prev, normalized, participantIds)
    );
  }

  function togglePlayedGame(gameId) {
    const id = String(gameId || "").trim();
    if (!id) return;
    setPlayedGameIds((prev) => {
      const existing = normalizePlayedGameIds(prev, winnerGameId || null);
      const has = existing.includes(id);
      return normalizePlayedGameIds(
        has ? existing.filter((x) => x !== id) : [...existing, id],
        winnerGameId || null
      );
    });
  }

  function setRankedPlacement(userId, placeValue) {
    const uid = String(userId || "").trim();
    if (!uid) return;
    setPlacements((prev) => {
      const next = new Map(
        normalizeParticipantPlacements(prev, "ranked", participantIds)
          .map((e) => [e.userId, e])
      );
      if (placeValue == null) {
        next.delete(uid);
      } else {
        next.set(uid, { userId: uid, place: placeValue });
      }
      return normalizeParticipantPlacements([...next.values()], "ranked", participantIds);
    });
  }

  function toggleCoopWinner(userId) {
    const uid = String(userId || "").trim();
    if (!uid) return;
    setPlacements((prev) => {
      const next = new Map(
        normalizeParticipantPlacements(prev, "coop-win", participantIds)
          .map((e) => [e.userId, e])
      );
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.set(uid, { userId: uid, place: 1 });
      }
      return normalizeParticipantPlacements([...next.values()], "coop-win", participantIds);
    });
  }

  function addParticipant(userId) {
    const id = String(userId || "").trim();
    if (!id) {
      onToast?.("Enter a valid user ID.", "error");
      return false;
    }

    if (participantIds.includes(id)) return false;

    setParticipantIds((prev) =>
      normalizeParticipantIds([...prev, id], groupMemberIds)
    );

    return true;
  }

  function removeParticipant(userId) {
    const id = String(userId || "").trim();
    if (!id) return;

    setParticipantIds((prev) => {
      const next = normalizeParticipantIds(prev.filter((value) => value !== id), groupMemberIds);
      setPlacements((priorPlacements) =>
        normalizeParticipantPlacements(priorPlacements, resultMode, next)
      );
      return next;
    });
  }

  async function runParticipantSearch() {
    if (!onSearchAccounts) return;

    const queryText = String(participantSearchQuery || "").trim();
    if (!queryText) {
      setParticipantSearchResults([]);
      onToast?.("Paste a user ID to look up a guest.", "error");
      return;
    }

    try {
      setIsSearchingParticipants(true);
      const rows = await onSearchAccounts(queryText);
      const nextRows = Array.isArray(rows) ? rows : [];
      const eligibleRows = nextRows.filter((row) => row?.isEligibleGuest !== false);

      if (eligibleRows.length < nextRows.length) {
        onToast?.("Temporary accounts cannot be added as guests.", "error");
      }

      setParticipantSearchResults(eligibleRows);

      if (nextRows.length === 0) {
        onToast?.("No user found for that ID.", "info");
      }
    } catch (err) {
      console.error("Participant search failed:", err);
      setParticipantSearchResults([]);
      onToast?.("Could not look up that user ID.", "error");
    } finally {
      setIsSearchingParticipants(false);
    }
  }

  async function handleSave() {
    if (isSaving) return;
    const effectiveWinnerId = winnerGameId.trim() || null;
    await onSave({
      playedAt: fromDateInputValue(playedDate),
      winnerGameId: effectiveWinnerId,
      playedGameIds: normalizePlayedGameIds(playedGameIds, effectiveWinnerId),
      participantIds: normalizeParticipantIds(participantIds, groupMemberIds),
      resultMode: normalizeResultMode(
        resultMode,
        defaultResultMode(effectiveWinnerId)
      ),
      placements: normalizeParticipantPlacements(
        placements,
        resultMode,
        participantIds
      ),
      metrics: normalizeSessionMetrics(metrics),
    });
  }

  function addMetric() {
    setMetrics((prev) => [...prev, { name: "", value: "" }]);
  }

  function updateMetricName(index, name) {
    setMetrics((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, name } : entry))
    );
  }

  function updateMetricValue(index, value) {
    setMetrics((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, value } : entry))
    );
  }

  function removeMetric(index) {
    setMetrics((prev) => prev.filter((_, i) => i !== index));
  }

  // All games except the current winner — shown as additional-games checkboxes
  const additionalGames = sortedGames.filter((g) => g.id !== winnerGameId);

  return (
    <div className="space-y-5">
      {/* Played date */}
      <div>
        <label className="ui-field-label">Played date</label>
        <input
          type="date"
          value={playedDate}
          onChange={(e) => setPlayedDate(e.target.value)}
          className="w-full"
        />
      </div>

      {/* Selected / winner game */}
      <div>
        <label className="ui-field-label">Selected game</label>
        <div className="ui-field-hint mb-2">
          The game that was chosen to play this session.
        </div>
        <select
          className="w-full"
          value={winnerGameId}
          onChange={(e) => handleWinnerChange(e.target.value)}
        >
          <option value="">— No selected game —</option>
          {sortedGames.map((g) => (
            <option key={g.id} value={g.id}>
              {g.title}
            </option>
          ))}
        </select>
      </div>

      {/* Additional games */}
      <div>
        <div className="ui-field-label">Additional games played</div>
        <div className="ui-field-hint mb-3">
          Select any other games the group also played during this session.
        </div>
        <div className="ui-surface-subtle border rounded-xl overflow-hidden">
          <div className="max-h-52 overflow-y-auto">
            {additionalGames.length === 0 ? (
              <div className="px-3 py-3 text-sm text-neutral-400">
                No other games in this group.
              </div>
            ) : (
              additionalGames.map((g) => {
                const checked = playedGameIds.includes(g.id);
                return (
                  <label
                    key={g.id}
                    className="flex w-full items-start gap-3 px-3 py-3 border-b border-neutral-700 last:border-b-0 cursor-pointer hover:bg-neutral-800 transition"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0"
                      checked={checked}
                      onChange={() => togglePlayedGame(g.id)}
                    />
                    <span className="block flex-1 min-w-0 break-words text-sm text-neutral-300">
                      {g.title}
                    </span>
                  </label>
                );
              })
            )}
          </div>
        </div>
      </div>

      {/* Participants */}
      <div className="ui-surface-subtle border rounded-xl">
        <div className="px-3 py-2 border-b border-neutral-700">
          <div className="ui-field-label">Participants</div>
          <div className="ui-field-hint">
            Session participants can include group members and guest accounts.
          </div>
        </div>

        <div className="px-3 py-3 space-y-3">
          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
              Current participants ({participantOptions.length})
            </div>

            {participantOptions.length === 0 ? (
              <div className="text-sm text-neutral-400">No participants selected.</div>
            ) : (
              <div className="flex flex-wrap gap-2">
                {participantOptions.map((participant) => {
                  const avatar = resolveAvatar(participant.avatarId);
                  return (
                    <span
                      key={`selected-participant-${participant.userId}`}
                      className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
                    >
                      <span className="h-5 w-5 overflow-hidden rounded-full border border-neutral-600 bg-neutral-800 flex items-center justify-center text-[11px]">
                        {avatar?.src ? (
                          <img
                            src={avatar.src}
                            alt={avatar?.label || "Avatar"}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          avatar?.icon || avatarIconById(participant.avatarId)
                        )}
                      </span>
                      <span>{participant.label}</span>
                      {!participant.isMember && <span className="text-neutral-400">(Guest)</span>}
                      <button
                        type="button"
                        className="text-neutral-400 hover:text-white"
                        onClick={() => removeParticipant(participant.userId)}
                        title="Remove from this session"
                      >
                        ×
                      </button>
                    </span>
                  );
                })}
              </div>
            )}
          </div>

          {addableMemberOptions.length > 0 && (
            <div>
              <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Add group members</div>
              <div className="flex flex-wrap gap-2">
                {addableMemberOptions.map((member) => (
                  <button
                    key={`member-add-${member.userId}`}
                    type="button"
                    className="ui-pill ui-pill-inactive text-xs"
                    onClick={() => addParticipant(member.userId)}
                  >
                    + {member.label}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div>
            <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Add guest account</div>
            <div className="ui-field-hint mb-2">Use the exact user ID.</div>
            <div className="flex gap-2">
              <input
                type="text"
                className="w-full"
                placeholder="Paste exact user ID"
                value={participantSearchQuery}
                onChange={(e) => setParticipantSearchQuery(e.target.value)}
              />
              <button
                type="button"
                className="ui-btn-secondary text-xs px-3"
                onClick={runParticipantSearch}
                disabled={isSearchingParticipants || !String(participantSearchQuery || "").trim()}
              >
                {isSearchingParticipants ? "Looking up…" : "Find"}
              </button>
            </div>

            {participantSearchResults.length > 0 && (
              <div className="mt-2 space-y-2">
                {participantSearchResults.map((result) => {
                  const userId = String(result?.userId || "").trim();
                  if (!userId) return null;
                  const alreadySelected = participantIds.includes(userId);
                  const avatar = resolveAvatar(result?.avatarId);

                  return (
                    <div
                      key={`search-result-${userId}`}
                      className="flex items-center justify-between gap-3 rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2"
                    >
                      <div className="flex items-center gap-2 min-w-0">
                        <span className="h-6 w-6 overflow-hidden rounded-full border border-neutral-600 bg-neutral-800 flex items-center justify-center text-[11px] shrink-0">
                          {avatar?.src ? (
                            <img
                              src={avatar.src}
                              alt={avatar?.label || "Avatar"}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            avatar?.icon || avatarIconById(result?.avatarId)
                          )}
                        </span>
                        <div className="min-w-0">
                          <div className="text-sm text-neutral-200 truncate">
                            {String(result?.nickname || "").trim() || memberDisplayName(null, userId)}
                          </div>
                          <div className="text-xs text-neutral-500 truncate">{userId}</div>
                        </div>
                      </div>

                      <button
                        type="button"
                        className="ui-btn-secondary text-xs px-2.5 py-1"
                        disabled={alreadySelected}
                        onClick={() => {
                          if (result?.isEligibleGuest === false) {
                            onToast?.("Temporary accounts cannot be added as guests.", "error");
                            return;
                          }

                          if (alreadySelected) {
                            onToast?.("That participant is already added.", "info");
                            return;
                          }

                          const added = addParticipant(userId);
                          if (added) {
                            onToast?.("Guest added to this session.", "success");
                          } else {
                            onToast?.("Could not add that participant.", "error");
                          }
                        }}
                      >
                        {alreadySelected ? "Added" : "Add"}
                      </button>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Result mode */}
      <div>
        <div className="ui-field-label">Result type</div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
          {SESSION_RESULT_MODE_OPTIONS.map((option) => {
            const selected = resultMode === option.value;
            return (
              <button
                key={option.value}
                type="button"
                className={`ui-pill text-xs ${
                  selected ? "ui-pill-active" : "ui-pill-inactive"
                }`}
                onClick={() => handleResultModeChange(option.value)}
              >
                {option.label}
              </button>
            );
          })}
        </div>
      </div>

      {/* Ranked placements */}
      {resultMode === "ranked" && (
        <div className="ui-surface-subtle border rounded-xl">
          <div className="px-3 py-2 border-b border-neutral-700">
            <div className="ui-field-hint">
              Assign placements, or leave players unassigned. Ties are supported.
            </div>
          </div>

          {participantOptions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-neutral-400">
              No participants available.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {participantOptions.map((participant) => {
                const selectedPlacement = placements.find(
                  (e) => e.userId === participant.userId
                );
                const avatar = resolveAvatar(participant.avatarId);

                return (
                  <div
                    key={participant.userId}
                    className="flex items-center justify-between gap-3 px-3 py-3 border-b border-neutral-700 last:border-b-0"
                  >
                    <div className="flex items-center gap-2 min-w-0">
                      <span className="h-6 w-6 overflow-hidden rounded-full border border-neutral-600 bg-neutral-800 flex items-center justify-center text-xs shrink-0">
                        {avatar.src ? (
                          <img
                            src={avatar.src}
                            alt={avatar.label}
                            className="h-full w-full object-cover"
                          />
                        ) : (
                          avatar?.icon || avatarIconById(participant.avatarId)
                        )}
                      </span>
                      <span className="text-sm text-neutral-300 min-w-0 truncate">
                        {participant.label}
                        {!participant.isMember && " (Guest)"}
                      </span>
                    </div>

                    <select
                      className="text-sm"
                      value={selectedPlacement?.place || ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setRankedPlacement(
                          participant.userId,
                          raw ? Number(raw) : null
                        );
                      }}
                    >
                      <option value="">Unassigned</option>
                      {placementChoices.map((place) => (
                        <option key={place} value={place}>
                          {formatPlaceLabel(place)}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* Co-op win checkboxes */}
      {resultMode === "coop-win" && (
        <div className="ui-surface-subtle border rounded-xl">
          <div className="px-3 py-2 border-b border-neutral-700">
            <div className="ui-field-hint">
              Select the players who won together.
            </div>
          </div>

          {participantOptions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-neutral-400">
              No participants available.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {participantOptions.map((participant) => {
                const checked = placements.some(
                  (e) => e.userId === participant.userId
                );
                const avatar = resolveAvatar(participant.avatarId);

                return (
                  <label
                    key={participant.userId}
                    className="flex w-full items-start gap-3 px-3 py-3 border-b border-neutral-700 last:border-b-0 cursor-pointer hover:bg-neutral-800 transition"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0"
                      checked={checked}
                      onChange={() => toggleCoopWinner(participant.userId)}
                    />
                    <span className="block flex-1 min-w-0 break-words text-sm text-neutral-300">
                      <span className="inline-flex items-center gap-2 min-w-0">
                        <span className="h-6 w-6 overflow-hidden rounded-full border border-neutral-600 bg-neutral-800 flex items-center justify-center text-xs shrink-0">
                          {avatar.src ? (
                            <img
                              src={avatar.src}
                              alt={avatar.label}
                              className="h-full w-full object-cover"
                            />
                          ) : (
                            avatar?.icon || avatarIconById(participant.avatarId)
                          )}
                        </span>
                        <span className="min-w-0 truncate">
                          {participant.label}
                          {!participant.isMember && " (Guest)"}
                        </span>
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>
          )}
        </div>
      )}

      {resultMode === "coop-loss" && (
        <div className="ui-surface-subtle p-4 rounded-xl">
          <p className="text-sm text-neutral-300">
            This session will be recorded as a co-op loss.
          </p>
        </div>
      )}

      {resultMode === "no-winner" && (
        <div className="ui-surface-subtle p-4 rounded-xl">
          <p className="text-sm text-neutral-300">
            This session will be recorded with no player winner.
          </p>
        </div>
      )}

      <div className="ui-surface-subtle border rounded-xl">
        <div className="px-3 py-2 border-b border-neutral-700 flex items-center justify-between gap-3">
          <div>
            <div className="ui-field-label">Custom metrics</div>
            <div className="ui-field-hint">Add numeric session-level stats (optional).</div>
          </div>
          <button
            type="button"
            className="ui-btn-secondary text-xs px-2.5 py-1"
            onClick={addMetric}
          >
            Add metric
          </button>
        </div>

        <div className="px-3 py-3 space-y-2">
          {metrics.length === 0 ? (
            <div className="text-sm text-neutral-400">No custom metrics added.</div>
          ) : (
            metrics.map((entry, index) => (
              <div
                key={`metric-${index}`}
                className="grid grid-cols-1 sm:grid-cols-[1fr_160px_auto] gap-2"
              >
                <input
                  type="text"
                  placeholder="Metric name"
                  className="w-full"
                  value={entry.name}
                  onChange={(e) => updateMetricName(index, e.target.value)}
                />
                <input
                  type="number"
                  inputMode="decimal"
                  placeholder="Value"
                  className="w-full"
                  value={entry.value}
                  onChange={(e) => updateMetricValue(index, e.target.value)}
                />
                <button
                  type="button"
                  className="ui-btn-secondary text-xs px-2.5 py-1"
                  onClick={() => removeMetric(index)}
                >
                  Remove
                </button>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Actions */}
      <div className="flex items-center gap-3 pt-2 border-t border-neutral-700">
        <button
          type="button"
          className="ui-btn-secondary flex-1 text-sm"
          onClick={onClose}
          disabled={isSaving}
        >
          Cancel
        </button>
        <button
          type="button"
          className="ui-btn-primary flex-1 text-sm"
          onClick={handleSave}
          disabled={isSaving}
        >
          {isSaving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </div>
  );
}
