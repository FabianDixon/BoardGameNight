// src/components/VotingPanel.jsx
import { useMemo, useState } from "react";
import GameImage from "./GameImage";
import Fab from "./ui/Fab";
import { VOTE_STATUS } from "../constants/workflow";

function VoteTile({
  game,
  selected,
  disabled,
  showNew,
  inPool,
  isMine,
  onClick,
}) {
  const imgSrc = game.imageThumbUrl || game.imageUrl || null;

  return (
    <button
      type="button"
      disabled={disabled}
      onClick={onClick}
      className={[
        "w-full text-left rounded-xl transition",
        "focus:outline-none",
        selected
          ? "outline outline-4 outline-blue-500 outline-offset-2"
          : "outline outline-1 outline-gray-700 hover:outline-blue-300 hover:outline-2 hover:outline-offset-2",
        disabled ? "opacity-40 cursor-not-allowed" : "cursor-pointer",
      ].join(" ")}
    >
      <div className="relative">
        {imgSrc ? (
          <GameImage
            src={imgSrc}
            alt={game.title}
            variant="square"
            containPct={0.9}
            className="bg-neutral-800"
          />
        ) : (
          <div className="w-full aspect-square rounded-xl bg-neutral-800 flex items-center justify-center text-gray-400 text-sm">
            No image
          </div>
        )}

        <div className="absolute top-2 left-2 flex gap-1 text-xs">
          {showNew && <span className="bg-black/70 px-1.5 py-0.5 rounded">🆕</span>}
          {inPool && <span className="bg-black/70 px-1.5 py-0.5 rounded">🎲</span>}
          {isMine && <span className="bg-black/70 px-1.5 py-0.5 rounded">👤</span>}
        </div>
      </div>

      <div className="mt-2 px-2 pb-2 text-sm font-medium text-center text-white truncate">
        {game.title}
      </div>
    </button>
  );
}

function byScoreDesc(a, b) {
  return (b.score || 0) - (a.score || 0);
}

function formatScore(n) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

function formatProgress(x, n) {
  if (!n) return "—";
  return `${Math.min(x || 0, n)} / ${n}`;
}

function titleById(gameMap, id) {
  return gameMap.get(id)?.title || id;
}

function normalizePlayedGameIds(playedGameIds, winnerGameId) {
  const winnerId = typeof winnerGameId === "string" && winnerGameId.trim()
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

function formatPlayedDate(timestamp) {
  if (typeof timestamp !== "number" || !Number.isFinite(timestamp)) return "Date not set";
  const d = new Date(timestamp);
  if (Number.isNaN(d.getTime())) return "Invalid date";
  
  const options = { year: "numeric", month: "short", day: "numeric" };
  return d.toLocaleDateString(undefined, options);
}

function truncateUserId(userId) {
  const value = String(userId || "").trim();
  if (!value) return "Unknown member";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

const SESSION_RESULT_MODE_OPTIONS = [
  { value: "ranked", label: "Ranked" },
  { value: "coop-win", label: "Co-op win" },
  { value: "coop-loss", label: "Co-op loss" },
  { value: "no-winner", label: "No winner" },
];

const SESSION_RESULT_MODE_SET = new Set(
  SESSION_RESULT_MODE_OPTIONS.map((option) => option.value)
);

function defaultResultMode(winnerGameId) {
  return winnerGameId ? "ranked" : "no-winner";
}

function normalizeResultMode(value, fallbackMode) {
  return SESSION_RESULT_MODE_SET.has(value) ? value : fallbackMode;
}

function normalizePlacements(placements, resultMode) {
  const mode = normalizeResultMode(resultMode, "no-winner");

  if (mode === "coop-loss" || mode === "no-winner") {
    return [];
  }

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

function memberDisplayName(member, fallbackUserId = "") {
  const nickname = String(member?.nickname || "").trim();
  if (nickname) return nickname;

  if (member) {
    return "Unnamed member";
  }

  return truncateUserId(fallbackUserId);
}

function sessionLabelFromIndex(sessionIndex, fallback = "Session") {
  if (typeof sessionIndex === "number" && Number.isFinite(sessionIndex) && sessionIndex >= 1) {
    return `Session #${sessionIndex}`;
  }
  return fallback;
}

function resultModeLabel(resultMode) {
  switch (resultMode) {
    case "ranked":
      return "Ranked";
    case "coop-win":
      return "Co-op win";
    case "coop-loss":
      return "Co-op loss";
    case "no-winner":
      return "No winner";
    default:
      return "Result";
  }
}

function formatPlacementsSummary(resultMode, placements, memberMap) {
  const normalizedMode = normalizeResultMode(resultMode, "no-winner");
  const normalizedPlacements = normalizePlacements(placements, normalizedMode);

  if (normalizedMode === "coop-loss") {
    return "Co-op loss recorded.";
  }

  if (normalizedMode === "no-winner") {
    return "No player winner recorded.";
  }

  if (normalizedMode === "coop-win") {
    if (normalizedPlacements.length === 0) return "Co-op win recorded.";
    return `Co-op winners: ${normalizedPlacements
      .map((entry) => memberDisplayName(memberMap.get(entry.userId), entry.userId))
      .join(", ")}`;
  }

  if (normalizedPlacements.length === 0) {
    return "No player placements recorded.";
  }

  const grouped = new Map();
  for (const entry of normalizedPlacements) {
    const key = entry.place;
    const names = grouped.get(key) || [];
    names.push(memberDisplayName(memberMap.get(entry.userId), entry.userId));
    grouped.set(key, names);
  }

  return [...grouped.entries()]
    .sort((a, b) => a[0] - b[0])
    .map(([place, names]) => `${formatPlaceLabel(place)}: ${names.join(", ")}`)
    .join(" · ");
}

function VotingPanelInner({
  user,
  currentGroupId,
  groupSettings,
  groupGames,
  members,

  poolActiveIds,
  submittedGameIds,

  activeVote,
  mySubmissionGameId,
  myBallot,
  results,

  onCallSession,
  onSubmitGame,
  onSubmitNoSubmission,
  onStartVoting,
  onCastVote,
  onCloseVote,
  onExportSession,
  onEmailSession,
  sessionPlayRecord,
  onSaveSessionPlay,
  isSavingSessionPlay,
  sessionHistory,
  showArchiveHistory = true,

  canEmailSession,
  canManageSession,
  canCloseActiveVote,

  groupMemberCount = 0,
  submissionsCount = 0,
  ballotsCount = 0,
}) {
  const gameMap = useMemo(
    () => new Map((groupGames || []).map((g) => [g.id, g])),
    [groupGames]
  );

  const status = activeVote?.status || null; // collecting | open | closed | null

  const candidateIds = useMemo(() => {
    if (!activeVote) return [];
    if (Array.isArray(activeVote.candidates) && activeVote.candidates.length > 0) {
      return activeVote.candidates;
    }
    return (results || []).map((r) => r.gameId);
  }, [activeVote, results]);

  const mySubId = useMemo(() => {
    const x = mySubmissionGameId;
    if (!x) return null;

    // if parent passes the new object shape { gameId, isNoSubmission, exists }
    if (typeof x === "object" && "exists" in x) {
      return x.gameId ? String(x.gameId).trim() : null;
    }

    // legacy: if parent accidentally passes the whole submission doc shape
    if (typeof x === "object" && "gameId" in x) return String(x.gameId).trim();

    return String(x).trim();
  }, [mySubmissionGameId]);

  const isNoSubmission = useMemo(() => {
    const x = mySubmissionGameId;
    if (!x) return false;
    if (typeof x === "object" && "isNoSubmission" in x) {
      return x.isNoSubmission === true;
    }
    return false;
  }, [mySubmissionGameId]);

  const candidateIdsNormalized = useMemo(() => {
    return (candidateIds || []).map((x) => {
      if (x && typeof x === "object" && "gameId" in x) return String(x.gameId).trim();
      return String(x).trim();
    });
  }, [candidateIds]);

  const availableSubmissionGames = useMemo(() => {
    if (status !== VOTE_STATUS.COLLECTING) return [];

    const pool = poolActiveIds instanceof Set ? poolActiveIds : new Set();
    const submitted = submittedGameIds instanceof Set ? submittedGameIds : new Set();

    return (groupGames || []).filter((g) => !pool.has(g.id) && !submitted.has(g.id));
  }, [status, groupGames, poolActiveIds, submittedGameIds]);

  const [phaseSearch, setPhaseSearch] = useState("");

  const normalizedPhaseQuery = useMemo(
    () => phaseSearch.trim().toLowerCase(),
    [phaseSearch]
  );

  // Local selection for 2-step confirm flow (select -> submit/vote)
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [selectedVoteId, setSelectedVoteId] = useState(null);

  const selectedStillAvailable = useMemo(() => {
    if (!selectedSubmissionId) return false;
    return availableSubmissionGames.some((g) => g.id === selectedSubmissionId);
  }, [availableSubmissionGames, selectedSubmissionId]);

  const filteredSubmissionGames = useMemo(() => {
    if (!normalizedPhaseQuery) return availableSubmissionGames;
    return availableSubmissionGames.filter((g) =>
      (g.title || "").toLowerCase().includes(normalizedPhaseQuery)
    );
  }, [availableSubmissionGames, normalizedPhaseQuery]);

  const filteredCandidateIds = useMemo(() => {
    let ids = candidateIdsNormalized;

    if (groupSettings?.disallowVotingOwnSubmission && mySubId) {
      ids = ids.filter((id) => id !== mySubId);
    }

    if (!normalizedPhaseQuery) return ids;

    return ids.filter((id) => {
      const g = gameMap.get(id);
      return (g?.title || "").toLowerCase().includes(normalizedPhaseQuery);
    });
  }, [
    candidateIdsNormalized,
    gameMap,
    normalizedPhaseQuery,
    groupSettings?.disallowVotingOwnSubmission,
    mySubId,
  ]);

  const effectiveSelectedSubmissionId = selectedStillAvailable
    ? selectedSubmissionId
    : null;

  const canSubmit = !!user && !!currentGroupId && status === VOTE_STATUS.COLLECTING;
  const canVote = !!user && !!currentGroupId && status === VOTE_STATUS.OPEN;

  const hasSubmitted = !!mySubId || isNoSubmission;
  const alreadyVoted = !!myBallot?.gameId;

  const disallowOwnSubmissionVote =
    !!groupSettings?.disallowVotingOwnSubmission && !!mySubId;

  const selectedVoteStillAvailable = useMemo(() => {
    if (!selectedVoteId) return false;
    return filteredCandidateIds.includes(selectedVoteId);
  }, [filteredCandidateIds, selectedVoteId]);

  const effectiveSelectedVoteId = selectedVoteStillAvailable ? selectedVoteId : null;

  const submitDisabled = !canSubmit || !effectiveSelectedSubmissionId;

  const voteDisabled =
    !canVote ||
    alreadyVoted ||
    !effectiveSelectedVoteId ||
    (disallowOwnSubmissionVote && effectiveSelectedVoteId === mySubId);

  const scoredResults = useMemo(() => {
    const arr = Array.isArray(results) ? [...results] : [];
    const normalized = arr
      .map((r) => ({
        ...r,
        score: Number(r.score || 0),
        votes: Number(r.votes || 0),
        title: r.title || titleById(gameMap, r.gameId),
        isWinner: !!r.isWinner,
      }))
      .sort((a, b) => {
        if (a.isWinner && !b.isWinner) return -1;
        if (!a.isWinner && b.isWinner) return 1;
        return byScoreDesc(a, b);
      });

    return normalized;
  }, [results, gameMap]);

  const winnerRow = useMemo(
    () => scoredResults.find((r) => r.isWinner) || null,
    [scoredResults]
  );

  const winnerGameId = useMemo(() => {
    const x = activeVote?.winnerGameId;
    if (!x) return null;
    return String(x).trim() || null;
  }, [activeVote?.winnerGameId]);

  const historyOptions = useMemo(() => {
    return [...(groupGames || [])].sort((a, b) =>
      (a.title || "").localeCompare(b.title || "")
    );
  }, [groupGames]);

  const memberMap = useMemo(
    () => new Map((members || []).map((member) => [member.userId, member])),
    [members]
  );

  const memberOptions = useMemo(() => {
    return [...(members || [])].sort((a, b) =>
      memberDisplayName(a).localeCompare(memberDisplayName(b))
    );
  }, [members]);

  const initialHistoryPlayedDate = status === VOTE_STATUS.CLOSED
    ? toDateInputValue(
        typeof sessionPlayRecord?.playedAt === "number"
          ? sessionPlayRecord.playedAt
          : (typeof activeVote?.closedAt === "number" ? activeVote.closedAt : null)
      )
    : "";

  const initialHistoryPlayedGameIds = status === VOTE_STATUS.CLOSED
    ? normalizePlayedGameIds(
        sessionPlayRecord?.playedGameIds && sessionPlayRecord.playedGameIds.length
          ? sessionPlayRecord.playedGameIds
          : normalizePlayedGameIds([], winnerGameId),
        winnerGameId
      )
    : [];

  const initialHistoryResultMode = status === VOTE_STATUS.CLOSED
    ? normalizeResultMode(
        sessionPlayRecord?.resultMode,
        defaultResultMode(winnerGameId)
      )
    : defaultResultMode(winnerGameId);

  const initialHistoryPlacements = status === VOTE_STATUS.CLOSED
    ? normalizePlacements(sessionPlayRecord?.placements, initialHistoryResultMode)
    : [];

  const [historyPlayedDate, setHistoryPlayedDate] = useState(initialHistoryPlayedDate);
  const [historyPlayedGameIds, setHistoryPlayedGameIds] = useState(initialHistoryPlayedGameIds);
  const [historyResultMode, setHistoryResultMode] = useState(initialHistoryResultMode);
  const [historyPlacements, setHistoryPlacements] = useState(initialHistoryPlacements);

  const placementChoices = useMemo(() => {
    const count = Math.max(memberOptions.length, 4);
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [memberOptions.length]);

  async function handleSubmit() {
    if (submitDisabled) return;
    await onSubmitGame(effectiveSelectedSubmissionId);
    setSelectedSubmissionId(null);
  }

  async function handleVote() {
    if (voteDisabled) return;
    if (disallowOwnSubmissionVote && effectiveSelectedVoteId === mySubId) return; // hard block
    await onCastVote(effectiveSelectedVoteId);
    setSelectedVoteId(null);
  }

  async function handleSaveSessionPlay() {
    if (!onSaveSessionPlay || status !== VOTE_STATUS.CLOSED) return;
    if (isSavingSessionPlay) return;

    await onSaveSessionPlay({
      playedAt: fromDateInputValue(historyPlayedDate),
      playedGameIds: normalizePlayedGameIds(historyPlayedGameIds, winnerGameId),
      resultMode: historyResultMode,
      placements: normalizePlacements(historyPlacements, historyResultMode),
    });
  }

  function togglePlayedGame(gameId) {
    const id = String(gameId || "").trim();
    if (!id) return;

    setHistoryPlayedGameIds((prev) => {
      const existing = normalizePlayedGameIds(prev, winnerGameId);
      const has = existing.includes(id);

      if (has) {
        return normalizePlayedGameIds(
          existing.filter((x) => x !== id),
          winnerGameId
        );
      }

      return normalizePlayedGameIds([...existing, id], winnerGameId);
    });
  }

  function handleResultModeChange(nextMode) {
    const normalizedMode = normalizeResultMode(nextMode, defaultResultMode(winnerGameId));
    setHistoryResultMode(normalizedMode);
    setHistoryPlacements((prev) => normalizePlacements(prev, normalizedMode));
  }

  function setRankedPlacement(userId, placeValue) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) return;

    setHistoryPlacements((prev) => {
      const next = new Map(
        normalizePlacements(prev, "ranked").map((entry) => [entry.userId, entry])
      );

      if (placeValue == null) {
        next.delete(normalizedUserId);
      } else {
        next.set(normalizedUserId, { userId: normalizedUserId, place: placeValue });
      }

      return normalizePlacements([...next.values()], "ranked");
    });
  }

  function toggleCoopWinner(userId) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) return;

    setHistoryPlacements((prev) => {
      const next = new Map(
        normalizePlacements(prev, "coop-win").map((entry) => [entry.userId, entry])
      );

      if (next.has(normalizedUserId)) {
        next.delete(normalizedUserId);
      } else {
        next.set(normalizedUserId, { userId: normalizedUserId, place: 1 });
      }

      return normalizePlacements([...next.values()], "coop-win");
    });
  }

  return (
    <div className="space-y-4">
      <div className="bg-neutral-800 rounded-2xl shadow border border-neutral-700 p-4">
        <h2 className="text-2xl font-bold text-white">Session</h2>
        <div className="mt-2 text-sm text-gray-300">
          Active:{" "}
          <span className="font-semibold">
            {activeVote ? `Session (${activeVote.status || "?"})` : "—"}
          </span>
        </div>

        {activeVote?.status === VOTE_STATUS.COLLECTING && (
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="px-2 py-1 rounded-full border border-neutral-700 bg-neutral-900 text-white">
              Submissions: <span className="font-semibold tabular-nums">
                {formatProgress(submissionsCount, groupMemberCount)}
              </span>
            </span>

            {isNoSubmission && (
              <span className="px-2 py-1 rounded-full border border-neutral-700 bg-blue-900 text-blue-300">
                ⊗ No Submission
              </span>
            )}

            {mySubId && !isNoSubmission && (
              <span className="px-2 py-1 rounded-full border border-neutral-700 bg-green-900 text-green-300">
                ✅ Submitted
              </span>
            )}
          </div>
        )}

        {activeVote?.status === VOTE_STATUS.OPEN && (
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="px-2 py-1 rounded-full border border-neutral-700 bg-neutral-900 text-gray-300">
              Votes: <span className="font-semibold tabular-nums">
                {formatProgress(ballotsCount, groupMemberCount)}
              </span>
            </span>

            {alreadyVoted && (
              <span className="px-2 py-1 rounded-full border border-neutral-700 bg-green-900 text-green-300">
                ✅ Voted
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {!activeVote && (
            <button
              className="px-4 py-2 rounded-xl border border-neutral-700 bg-neutral-700 hover:bg-neutral-600 text-white"
              onClick={onCallSession}
            >
              Call session
            </button>
          )}

          {activeVote?.status === VOTE_STATUS.COLLECTING && canManageSession && (
            <button
              className="px-4 py-2 rounded-xl border border-neutral-700 bg-neutral-700 hover:bg-neutral-600 text-white"
              onClick={onStartVoting}
            >
              Start voting
            </button>
          )}

          {activeVote?.status === VOTE_STATUS.OPEN && (
            <button
              className="px-4 py-2 rounded-xl border border-neutral-700 bg-neutral-700 hover:bg-neutral-600 text-white"
              onClick={onCloseVote}
              disabled={!canCloseActiveVote}
              title={!canCloseActiveVote ? "Only session/group owner can close" : ""}
            >
              Close & reveal
            </button>
          )}

          {activeVote?.status === VOTE_STATUS.CLOSED && (
            <>
              <button
                className="px-4 py-2 rounded-xl border border-neutral-700 bg-neutral-700 hover:bg-neutral-600 text-white"
                onClick={() => onExportSession?.(activeVote.id)}
              >
                Download JSON
              </button>

              {canEmailSession && (
                <button
                  className="px-4 py-2 rounded-xl border border-neutral-700 bg-neutral-700 hover:bg-neutral-600 text-white"
                  onClick={() => onEmailSession?.(activeVote.id)}
                >
                  Email JSON
                </button>
              )}

              <button
                className="px-4 py-2 rounded-xl border border-neutral-700 bg-neutral-700 hover:bg-neutral-600 text-white"
                onClick={onCallSession}
              >
                Call next session
              </button>
            </>
          )}
        </div>

        {activeVote?.status === VOTE_STATUS.COLLECTING && (
          <div className="mt-4 text-sm text-gray-300">
            Your submission:{" "}
            <span className="font-semibold">
              {isNoSubmission
                ? "No Submission"
                : mySubId
                ? titleById(gameMap, mySubId)
                : "—"}
            </span>
          </div>
        )}

        {activeVote?.status === VOTE_STATUS.OPEN && (
          <div className="mt-4 text-sm text-gray-300">
            Your vote:{" "}
            <span className="font-semibold">
              {myBallot?.gameId ? titleById(gameMap, myBallot.gameId) : "—"}
            </span>
          </div>
        )}
      </div>

      {activeVote?.status === VOTE_STATUS.COLLECTING && (
        <div className="bg-neutral-800 rounded-2xl shadow border border-neutral-700 p-4 space-y-3 pb-28">
          <h3 className="text-xl font-semibold text-white">Submit game</h3>
          <p className="text-sm text-gray-300">
            Select a game and press <span className="font-semibold">Submit</span>, or choose{" "}
            <span className="font-semibold">No Submission</span> if you don't want to submit a game this round.
          </p>

          <button
            type="button"
            onClick={onSubmitNoSubmission}
            disabled={!canSubmit}
            className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-neutral-700 bg-neutral-900 hover:bg-neutral-800 hover:border-neutral-600 transition text-sm font-medium text-white disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⊗ {isNoSubmission ? "Already marked as no submission" : "No Submission"}
          </button>

          <input
            type="text"
            placeholder="Search by title..."
            value={phaseSearch}
            onChange={(e) => setPhaseSearch(e.target.value)}
            className="w-full border border-neutral-700 rounded-lg px-3 py-2 text-sm bg-neutral-900 text-white placeholder-gray-500"
          />
        
          {filteredSubmissionGames.length === 0 ? (
            <p className="text-sm text-gray-300">No matches for "{phaseSearch}".</p>
          ) : (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 items-start">
            {filteredSubmissionGames.map((g) => {
              const selected = effectiveSelectedSubmissionId === g.id;

              return (
                <VoteTile
                  key={g.id}
                  game={g}
                  selected={selected}
                  disabled={false}
                  showNew={false} // optionally wire group-newness later
                  inPool={false}  // collecting list already excludes pool games
                  isMine={false} // all games in collecting phase are by definition not mine
                  onClick={() => {
                    setSelectedSubmissionId(g.id);
                  }}
                />
              );
            })}
          </div>
          )}
        </div>
      )}

      {activeVote?.status === VOTE_STATUS.OPEN && (
        <div className="bg-neutral-800 rounded-2xl shadow border border-neutral-700 p-4 space-y-3 pb-28">
          <h3 className="text-xl font-semibold text-white">Cast your vote</h3>
          <p className="text-sm text-gray-300">
            Select a game, then press <span className="font-semibold">Vote</span>. Your vote is secret until revealed.
          </p>

          <input
            type="text"
            placeholder="Search by title..."
            value={phaseSearch}
            onChange={(e) => setPhaseSearch(e.target.value)}
            className="w-full border border-neutral-700 rounded-lg px-3 py-2 text-sm bg-neutral-900 text-white placeholder-gray-500"
          />
          {filteredCandidateIds.length === 0 ? (
            <p className="text-sm text-gray-300">No matches for "{phaseSearch}".</p>
          ) : (
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 items-start">
              {filteredCandidateIds.map((id) => {
                if (groupSettings?.disallowVotingOwnSubmission && mySubId && id === mySubId) {
                  return null;
                }
                const g = gameMap.get(id) || { id, title: id, imageUrl: "" };
                const selected = effectiveSelectedVoteId === id;

                return (
                  <VoteTile
                    key={id}
                    game={g}
                    selected={selected}
                    disabled={alreadyVoted}
                    showNew={false}
                    inPool={true}
                    isMine={false}
                    onClick={() => {
                      if (alreadyVoted) return;
                      if (disallowOwnSubmissionVote && id === mySubId) return; // hard block
                      setSelectedVoteId(id);
                    }}
                  />
                );
              })}
            </div>
          )}
        </div>
      )}

      {activeVote?.status === VOTE_STATUS.CLOSED && (
        <div className="bg-neutral-800 rounded-2xl shadow border border-neutral-700 p-4 space-y-3">
          <h3 className="text-xl font-semibold text-white">Results</h3>

          {winnerRow ? (
            <div className="p-3 rounded-xl border border-neutral-700 bg-neutral-900">
              <div className="text-sm text-gray-400">Winner</div>
              <div className="text-lg font-semibold flex items-center gap-2 text-white">
                {winnerRow.title}
                <span className="text-xs px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-800 text-gray-300">
                  🏆 Winner
                </span>
              </div>

              <div className="text-sm text-gray-300 mt-1">
                Score:{" "}
                <span className="font-semibold tabular-nums">
                  {formatScore(winnerRow.score)}
                </span>
                {" · "}
                Votes: <span className="tabular-nums">{winnerRow.votes}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-300">No winner recorded (no votes cast).</p>
          )}

          <div>
            <div className="text-sm font-semibold mb-2 text-white">Scores</div>
            {scoredResults.length === 0 ? (
              <p className="text-sm text-gray-300">No results.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {scoredResults.map((r) => (
                  <li
                    key={r.gameId}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className={r.isWinner ? "font-semibold text-white" : "text-gray-300"}>
                      {r.isWinner ? "🏆 " : ""}
                      {r.title}
                    </span>
                    <span className="tabular-nums text-gray-300">
                      {formatScore(r.score)}
                      <span className="text-gray-400">
                        {" "}
                        · {r.votes} vote{r.votes === 1 ? "" : "s"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
          </div>

          <div className="pt-2 border-t border-neutral-700 space-y-3">
            <div className="text-sm font-semibold text-white">Session history</div>

            <div className="text-xs text-gray-400">
              {sessionLabelFromIndex(
                sessionPlayRecord?.sessionIndex,
                "Current session"
              )}
            </div>

            <div>
              <label className="block text-sm font-medium mb-1 text-gray-300">Played date</label>
              <input
                type="date"
                value={historyPlayedDate}
                onChange={(e) => setHistoryPlayedDate(e.target.value)}
                className="w-full border border-neutral-700 rounded-lg px-3 py-2 text-sm bg-neutral-900 text-white"
              />
            </div>

            <div className="space-y-3">
              <div>
                <div className="text-sm font-medium mb-1 text-gray-300">Primary played game</div>
                {winnerGameId ? (
                  <div className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm flex items-center justify-between gap-3">
                    <span className="font-medium text-white">{titleById(gameMap, winnerGameId)}</span>
                    <span className="text-xs text-gray-400">Winner (prefilled)</span>
                  </div>
                ) : (
                  <div className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-2 text-sm text-gray-400">
                    No winner was recorded for this session.
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-medium mb-1 text-gray-300">Additional played games</div>
                <div className="text-xs text-gray-400 mb-2">
                  Select any other games the group also played.
                </div>

                <div className="rounded-lg border border-neutral-700 bg-neutral-900">
                  <div className="max-h-60 overflow-y-auto">
                    {historyOptions
                      .filter((g) => g.id !== winnerGameId)
                      .map((g) => {
                        const checked = historyPlayedGameIds.includes(g.id);
                        return (
                          <label
                            key={g.id}
                            className="flex w-full items-start gap-3 px-3 py-3 border-b border-neutral-700 last:border-b-0 cursor-pointer hover:bg-neutral-800"
                          >
                            <input
                              type="checkbox"
                              className="mt-1 shrink-0"
                              checked={checked}
                              onChange={() => togglePlayedGame(g.id)}
                            />
                            <span className="block flex-1 min-w-0 break-words text-sm leading-5 text-gray-300">
                              {g.title}
                            </span>
                          </label>
                        );
                      })}
                  </div>
                </div>
              </div>

              <div>
                <div className="text-sm font-medium mb-1 text-gray-300">Player results</div>
                <div className="text-xs text-gray-400 mb-2">
                  Record player placements or co-op outcomes for this session.
                </div>

                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 mb-3">
                  {SESSION_RESULT_MODE_OPTIONS.map((option) => {
                    const selected = historyResultMode === option.value;
                    return (
                      <button
                        key={option.value}
                        type="button"
                        className={[
                          "rounded-lg border px-3 py-2 text-sm transition",
                          selected
                            ? "border-blue-500 bg-blue-900 text-blue-100"
                            : "border-neutral-700 bg-neutral-900 text-gray-300 hover:bg-neutral-800",
                        ].join(" ")}
                        onClick={() => handleResultModeChange(option.value)}
                      >
                        {option.label}
                      </button>
                    );
                  })}
                </div>

                {historyResultMode === "ranked" && (
                  <div className="rounded-lg border border-neutral-700 bg-neutral-900">
                    <div className="px-3 py-2 border-b border-neutral-700 text-xs text-gray-400">
                      Assign the same place to multiple players to record a tie. Leave players unassigned if needed.
                    </div>

                    {memberOptions.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-gray-400">No group members available.</div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto">
                        {memberOptions.map((member) => {
                          const selectedPlacement = historyPlacements.find(
                            (entry) => entry.userId === member.userId
                          );

                          return (
                            <div
                              key={member.userId}
                              className="flex items-center justify-between gap-3 px-3 py-3 border-b border-neutral-700 last:border-b-0"
                            >
                              <span className="text-sm text-gray-300 min-w-0 truncate">
                                {memberDisplayName(member, member.userId)}
                              </span>

                              <select
                                className="border border-neutral-700 rounded px-2 py-1.5 text-sm bg-neutral-800 text-white"
                                value={selectedPlacement?.place || ""}
                                onChange={(e) => {
                                  const rawValue = e.target.value;
                                  setRankedPlacement(
                                    member.userId,
                                    rawValue ? Number(rawValue) : null
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

                {historyResultMode === "coop-win" && (
                  <div className="rounded-lg border border-neutral-700 bg-neutral-900">
                    <div className="px-3 py-2 border-b border-neutral-700 text-xs text-gray-400">
                      Select the players who won together.
                    </div>

                    {memberOptions.length === 0 ? (
                      <div className="px-3 py-3 text-sm text-gray-400">No group members available.</div>
                    ) : (
                      <div className="max-h-72 overflow-y-auto">
                        {memberOptions.map((member) => {
                          const checked = historyPlacements.some(
                            (entry) => entry.userId === member.userId
                          );

                          return (
                            <label
                              key={member.userId}
                              className="flex w-full items-start gap-3 px-3 py-3 border-b border-neutral-700 last:border-b-0 cursor-pointer hover:bg-neutral-800"
                            >
                              <input
                                type="checkbox"
                                className="mt-1 shrink-0"
                                checked={checked}
                                onChange={() => toggleCoopWinner(member.userId)}
                              />
                              <span className="block flex-1 min-w-0 break-words text-sm leading-5 text-gray-300">
                                {memberDisplayName(member, member.userId)}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    )}
                  </div>
                )}

                {historyResultMode === "coop-loss" && (
                  <div className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-gray-300">
                    This session will be saved as a co-op loss with no winners or placements.
                  </div>
                )}

                {historyResultMode === "no-winner" && (
                  <div className="rounded-lg border border-neutral-700 bg-neutral-900 px-3 py-3 text-sm text-gray-300">
                    This session will be saved with no player winner or placements.
                  </div>
                )}
              </div>
            </div>

            <button
              type="button"
              className="px-4 py-2 rounded-xl border border-neutral-700 bg-neutral-700 hover:bg-neutral-600 text-white disabled:opacity-50"
              onClick={handleSaveSessionPlay}
              disabled={!canManageSession || isSavingSessionPlay}
              title={!canManageSession ? "Only session/group owner can save" : ""}
            >
              {isSavingSessionPlay ? "Saving…" : "Save session history"}
            </button>
          </div>
        </div>
      )}

      {/* Session History */}
      {showArchiveHistory && sessionHistory && sessionHistory.length > 0 && (
        <div className="bg-neutral-800 rounded-2xl shadow border border-neutral-700 p-4">
          <h3 className="text-xl font-semibold mb-3 text-white">Session History</h3>
          
          <div className="space-y-3">
            {sessionHistory.map((play) => {
              const selectedGameTitle = play.winnerGameId
                ? titleById(gameMap, play.winnerGameId)
                : "No selected game recorded";
              const playResultMode = normalizeResultMode(
                play.resultMode,
                defaultResultMode(play.winnerGameId)
              );
              const playPlacements = normalizePlacements(play.placements, playResultMode);
              const resultSummary = formatPlacementsSummary(
                playResultMode,
                playPlacements,
                memberMap
              );
              
              const playedGamesList = Array.isArray(play.playedGameIds)
                ? play.playedGameIds.filter((id) => id !== play.winnerGameId)
                : [];
              
              const additionalCount = playedGamesList.length;

              return (
                <div
                  key={play.id}
                  className="rounded-xl border border-neutral-700 bg-neutral-900 p-3"
                >
                  <div className="flex items-start justify-between gap-3 mb-2">
                    <div className="text-sm text-gray-400">
                      {formatPlayedDate(play.playedAt)}
                    </div>
                    <div className="flex flex-wrap items-center justify-end gap-2">
                      <div className="text-xs px-2 py-0.5 rounded-full border border-neutral-700 bg-neutral-800 text-gray-300">
                        {resultModeLabel(playResultMode)}
                      </div>
                      <div className="text-xs px-2 py-0.5 rounded-full bg-neutral-800 text-gray-400">
                        {sessionLabelFromIndex(play.sessionIndex)}
                      </div>
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="text-sm text-gray-400 mb-1">Selected game</div>
                    <div className="font-medium text-white flex items-center gap-2">
                      🎲 {selectedGameTitle}
                    </div>
                  </div>

                  <div className="mb-2">
                    <div className="text-sm text-gray-400 mb-1">Result</div>
                    <div className="text-sm text-gray-300">
                      {resultSummary}
                    </div>
                  </div>

                  {additionalCount > 0 && (
                    <div>
                      <div className="text-xs text-gray-400 mb-1">
                        Also played ({additionalCount})
                      </div>
                      <div className="text-sm text-gray-300">
                        {playedGamesList.map((id) => titleById(gameMap, id)).join(", ")}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      )}

      <Fab
        show={activeVote?.status === VOTE_STATUS.COLLECTING}
        variant="pill"
        label={hasSubmitted ? "Change Submission" : "Submit"}
        disabled={submitDisabled}
        onClick={handleSubmit}
      >
        {hasSubmitted ? "Change" : "Submit"}
      </Fab>

      <Fab
        show={activeVote?.status === VOTE_STATUS.OPEN}
        variant="pill"
        label={alreadyVoted ? "Voted" : "Vote"}
        disabled={voteDisabled}
        onClick={handleVote}
      >
        Vote
      </Fab>
    </div>
  );
}

export default function VotingPanel(props) {
  const phaseKey = [
    props.activeVote?.id || "no-vote",
    props.activeVote?.status || "none",
    props.sessionPlayRecord?.updatedAt || "no-play-update",
    props.sessionPlayRecord?.playedAt || "no-played-at",
    props.sessionHistory?.length || 0,
  ].join(":");
  return <VotingPanelInner key={phaseKey} {...props} />;
}