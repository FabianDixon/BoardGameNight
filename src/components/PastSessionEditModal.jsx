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

// ---------- component ----------

export default function PastSessionEditModal({
  play,
  groupGames,
  members,
  memberProfilesById = {},
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

  const [winnerGameId, setWinnerGameId] = useState(initialWinnerGameId);
  const [playedDate, setPlayedDate] = useState(toDateInputValue(play?.playedAt));
  const [playedGameIds, setPlayedGameIds] = useState(
    normalizePlayedGameIds(play?.playedGameIds, initialWinnerGameId)
  );
  const [resultMode, setResultMode] = useState(initialResultMode);
  const [placements, setPlacements] = useState(
    normalizePlacements(play?.placements, initialResultMode)
  );

  const sortedGames = useMemo(
    () =>
      [...(groupGames || [])].sort((a, b) =>
        (a.title || "").localeCompare(b.title || "")
      ),
    [groupGames]
  );

  const memberOptions = useMemo(
    () =>
      [...(members || [])].sort((a, b) =>
        memberDisplayName(a).localeCompare(memberDisplayName(b))
      ),
    [members]
  );

  const placementChoices = useMemo(
    () =>
      Array.from({ length: Math.max(memberOptions.length, 4) }, (_, i) => i + 1),
    [memberOptions.length]
  );

  function memberAvatarFor(member) {
    const userId = String(member?.userId || "").trim();
    const profileAvatarId = memberProfilesById?.[userId]?.avatarId;
    const avatarId = isValidAvatarId(profileAvatarId)
      ? profileAvatarId
      : isValidAvatarId(member?.avatarId)
      ? member.avatarId
      : DEFAULT_AVATAR_ID;
    const avatar = avatarById(avatarId);
    return {
      src: avatar?.src || null,
      icon: avatar?.icon || avatarIconById(avatarId),
      label: avatar?.label || "Avatar",
    };
  }

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
    setPlacements((prev) => normalizePlacements(prev, normalized));
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
        normalizePlacements(prev, "ranked").map((e) => [e.userId, e])
      );
      if (placeValue == null) {
        next.delete(uid);
      } else {
        next.set(uid, { userId: uid, place: placeValue });
      }
      return normalizePlacements([...next.values()], "ranked");
    });
  }

  function toggleCoopWinner(userId) {
    const uid = String(userId || "").trim();
    if (!uid) return;
    setPlacements((prev) => {
      const next = new Map(
        normalizePlacements(prev, "coop-win").map((e) => [e.userId, e])
      );
      if (next.has(uid)) {
        next.delete(uid);
      } else {
        next.set(uid, { userId: uid, place: 1 });
      }
      return normalizePlacements([...next.values()], "coop-win");
    });
  }

  async function handleSave() {
    if (isSaving) return;
    const effectiveWinnerId = winnerGameId.trim() || null;
    await onSave({
      playedAt: fromDateInputValue(playedDate),
      winnerGameId: effectiveWinnerId,
      playedGameIds: normalizePlayedGameIds(playedGameIds, effectiveWinnerId),
      resultMode: normalizeResultMode(
        resultMode,
        defaultResultMode(effectiveWinnerId)
      ),
      placements: normalizePlacements(placements, resultMode),
    });
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

          {memberOptions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-neutral-400">
              No group members available.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {memberOptions.map((member) => {
                const selectedPlacement = placements.find(
                  (e) => e.userId === member.userId
                );
                const avatar = memberAvatarFor(member);

                return (
                  <div
                    key={member.userId}
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
                          avatar.icon
                        )}
                      </span>
                      <span className="text-sm text-neutral-300 min-w-0 truncate">
                        {memberDisplayName(member, member.userId)}
                      </span>
                    </div>

                    <select
                      className="text-sm"
                      value={selectedPlacement?.place || ""}
                      onChange={(e) => {
                        const raw = e.target.value;
                        setRankedPlacement(
                          member.userId,
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

          {memberOptions.length === 0 ? (
            <div className="px-3 py-3 text-sm text-neutral-400">
              No group members available.
            </div>
          ) : (
            <div className="max-h-72 overflow-y-auto">
              {memberOptions.map((member) => {
                const checked = placements.some(
                  (e) => e.userId === member.userId
                );
                const avatar = memberAvatarFor(member);

                return (
                  <label
                    key={member.userId}
                    className="flex w-full items-start gap-3 px-3 py-3 border-b border-neutral-700 last:border-b-0 cursor-pointer hover:bg-neutral-800 transition"
                  >
                    <input
                      type="checkbox"
                      className="mt-1 shrink-0"
                      checked={checked}
                      onChange={() => toggleCoopWinner(member.userId)}
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
                            avatar.icon
                          )}
                        </span>
                        <span className="min-w-0 truncate">
                          {memberDisplayName(member, member.userId)}
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
