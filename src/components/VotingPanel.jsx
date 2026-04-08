// src/components/VotingPanel.jsx
import { useMemo, useState } from "react";
import GameImage from "./GameImage";
import Fab from "./ui/Fab";
import { VOTE_STATUS } from "../constants/workflow";
import {
  DEFAULT_AVATAR_ID,
  avatarById,
  avatarIconById,
} from "../constants/avatars";

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

function memberDisplayName(member, fallbackUserId = "") {
  const nickname = String(member?.nickname || "").trim();
  if (nickname) return nickname;

  if (member) {
    return "Unnamed member";
  }

  return truncateUserId(fallbackUserId);
}

function resolveAvatar(avatarId) {
  return (
    avatarById(avatarId) ||
    avatarById(DEFAULT_AVATAR_ID) ||
    { label: "Avatar", icon: avatarIconById(DEFAULT_AVATAR_ID), src: null }
  );
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
  editorSourceGameIds,

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
  participantSummaryById = {},
  onSearchAccounts,
  onToast,
  showArchiveHistory = true,

  canEmailSession,
  canManageSession,
  canCloseActiveVote,

  groupMemberCount = 0,
  submissionsCount = 0,
  ballotsCount = 0,
  onSaveVoteOverride,
  isSavingVoteOverride = false,
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
  const isDesktopViewport =
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

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

  const groupMemberIds = useMemo(() => {
    return (members || [])
      .map((member) => String(member?.userId || "").trim())
      .filter(Boolean);
  }, [members]);

  const memberOptions = useMemo(() => {
    return [...(members || [])]
      .filter((member) => String(member?.userId || "").trim())
      .sort((a, b) => memberDisplayName(a).localeCompare(memberDisplayName(b)));
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

  const initialHistoryParticipantIds = status === VOTE_STATUS.CLOSED
    ? normalizeParticipantIds(sessionPlayRecord?.participantIds, groupMemberIds)
    : normalizeParticipantIds([], groupMemberIds);

  const initialHistoryPlacements = status === VOTE_STATUS.CLOSED
    ? normalizeParticipantPlacements(
        sessionPlayRecord?.placements,
        initialHistoryResultMode,
        initialHistoryParticipantIds
      )
    : [];

  const initialHistoryMetrics = status === VOTE_STATUS.CLOSED
    ? normalizeSessionMetrics(sessionPlayRecord?.metrics).map((entry) => ({
        name: entry.name,
        value: String(entry.value),
      }))
    : [];

  const [historyPlayedDate, setHistoryPlayedDate] = useState(initialHistoryPlayedDate);
  const [historyPlayedGameIds, setHistoryPlayedGameIds] = useState(initialHistoryPlayedGameIds);
  const [historyResultMode, setHistoryResultMode] = useState(initialHistoryResultMode);
  const [historyParticipantIds, setHistoryParticipantIds] = useState(initialHistoryParticipantIds);
  const [historyPlacements, setHistoryPlacements] = useState(initialHistoryPlacements);
  const [historyMetrics, setHistoryMetrics] = useState(initialHistoryMetrics);
  const [participantSearchQuery, setParticipantSearchQuery] = useState("");
  const [participantSearchResults, setParticipantSearchResults] = useState([]);
  const [isSearchingParticipants, setIsSearchingParticipants] = useState(false);

  const [isVoteOverrideOpen, setIsVoteOverrideOpen] = useState(false);
  const [overrideDraft, setOverrideDraft] = useState([]);

  const overrideTotalVotes = useMemo(
    () => overrideDraft.reduce((sum, r) => sum + (Number(r.votes) || 0), 0),
    [overrideDraft]
  );
  const overrideVotesRemaining = groupMemberCount - overrideTotalVotes;

  const placementChoices = useMemo(() => {
    const count = Math.max(historyParticipantIds.length, 4);
    return Array.from({ length: count }, (_, index) => index + 1);
  }, [historyParticipantIds.length]);

  const participantOptions = useMemo(() => {
    return historyParticipantIds
      .map((userId) => {
        const member = memberMap.get(userId);
        const summary = participantSummaryById?.[userId] || null;
        return {
          userId,
          label:
            summary?.label ||
            memberDisplayName(member, userId),
          avatarId:
            summary?.avatarId ||
            member?.avatarId ||
            DEFAULT_AVATAR_ID,
          isMember: !!member,
        };
      })
      .sort((a, b) => a.label.localeCompare(b.label));
  }, [historyParticipantIds, memberMap, participantSummaryById]);

  const addableMemberOptions = useMemo(() => {
    const selected = new Set(historyParticipantIds);
    return memberOptions
      .filter((member) => !selected.has(String(member.userId || "").trim()))
      .map((member) => {
        const userId = String(member.userId || "").trim();
        return {
          userId,
          label: memberDisplayName(member, userId),
          avatarId: member?.avatarId || DEFAULT_AVATAR_ID,
        };
      });
  }, [memberOptions, historyParticipantIds]);

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
      participantIds: normalizeParticipantIds(historyParticipantIds, groupMemberIds),
      resultMode: historyResultMode,
      placements: normalizeParticipantPlacements(
        historyPlacements,
        historyResultMode,
        historyParticipantIds
      ),
      metrics: normalizeSessionMetrics(historyMetrics),
    });
  }

  function addMetric() {
    setHistoryMetrics((prev) => [...prev, { name: "", value: "" }]);
  }

  function updateMetricName(index, name) {
    setHistoryMetrics((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, name } : entry))
    );
  }

  function updateMetricValue(index, value) {
    setHistoryMetrics((prev) =>
      prev.map((entry, i) => (i === index ? { ...entry, value } : entry))
    );
  }

  function removeMetric(index) {
    setHistoryMetrics((prev) => prev.filter((_, i) => i !== index));
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
    setHistoryPlacements((prev) => normalizeParticipantPlacements(prev, normalizedMode, historyParticipantIds));
  }

  function setRankedPlacement(userId, placeValue) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) return;

    setHistoryPlacements((prev) => {
      const next = new Map(
        normalizeParticipantPlacements(prev, "ranked", historyParticipantIds)
          .map((entry) => [entry.userId, entry])
      );

      if (placeValue == null) {
        next.delete(normalizedUserId);
      } else {
        next.set(normalizedUserId, { userId: normalizedUserId, place: placeValue });
      }

      return normalizeParticipantPlacements([...next.values()], "ranked", historyParticipantIds);
    });
  }

  function toggleCoopWinner(userId) {
    const normalizedUserId = String(userId || "").trim();
    if (!normalizedUserId) return;

    setHistoryPlacements((prev) => {
      const next = new Map(
        normalizeParticipantPlacements(prev, "coop-win", historyParticipantIds)
          .map((entry) => [entry.userId, entry])
      );

      if (next.has(normalizedUserId)) {
        next.delete(normalizedUserId);
      } else {
        next.set(normalizedUserId, { userId: normalizedUserId, place: 1 });
      }

      return normalizeParticipantPlacements([...next.values()], "coop-win", historyParticipantIds);
    });
  }

  function addParticipant(userId) {
    const id = String(userId || "").trim();
    if (!id) {
      onToast?.("Enter a valid user ID.", "error");
      return false;
    }

    if (historyParticipantIds.includes(id)) return false;

    setHistoryParticipantIds((prev) =>
      normalizeParticipantIds([...prev, id], groupMemberIds)
    );

    return true;
  }

  function removeParticipant(userId) {
    const id = String(userId || "").trim();
    if (!id) return;

    setHistoryParticipantIds((prev) => {
      const next = normalizeParticipantIds(prev.filter((value) => value !== id), groupMemberIds);
      setHistoryPlacements((placements) =>
        normalizeParticipantPlacements(placements, historyResultMode, next)
      );
      return next;
    });
  }

  async function runParticipantSearch() {
    if (!onSearchAccounts) return;

    const queryValue = String(participantSearchQuery || "").trim();
    if (!queryValue) {
      setParticipantSearchResults([]);
      onToast?.("Paste a user ID to look up a guest.", "error");
      return;
    }

    try {
      setIsSearchingParticipants(true);
      const rows = await onSearchAccounts(queryValue);
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

  function openVoteOverrideEditor() {
    // Use editorSourceGameIds (submitted games or candidates) for the full editor list
    // Fall back to scoredResults if editorSourceGameIds is unavailable
    const sourceIds = (editorSourceGameIds instanceof Set && editorSourceGameIds.size > 0)
      ? editorSourceGameIds
      : new Set(scoredResults.map((r) => r.gameId));

    const scoredResultsMap = new Map(scoredResults.map((r) => [r.gameId, r]));

    setOverrideDraft(
      Array.from(sourceIds).map((gameId) => {
        const scored = scoredResultsMap.get(gameId);
        return {
          gameId,
          title: scored?.title || gameMap.get(gameId)?.title || gameId,
          votes: scored?.votes || 0,
          isWinner: scored?.isWinner || false,
        };
      })
    );
    setIsVoteOverrideOpen(true);
  }

  function handleSetOverrideVotes(gameId, value) {
    setOverrideDraft((prev) =>
      prev.map((r) =>
        r.gameId === gameId
          ? { ...r, votes: Math.max(0, Math.min(groupMemberCount, Number(value) || 0)) }
          : r
      )
    );
  }

  function handleSetOverrideWinner(gameId) {
    setOverrideDraft((prev) =>
      prev.map((r) => ({ ...r, isWinner: r.gameId === gameId }))
    );
  }

  async function handleSaveVoteOverride() {
    if (!onSaveVoteOverride || isSavingVoteOverride) return;
    const winnerEntry = overrideDraft.find((r) => r.isWinner);
    const winnerId = winnerEntry?.gameId || null;
    const toSave = overrideDraft.map(({ gameId, votes, isWinner }) => ({
      gameId,
      votes: Number(votes) || 0,
      isWinner: !!isWinner,
    }));
    await onSaveVoteOverride(toSave, winnerId);
    setIsVoteOverrideOpen(false);
  }

  return (
    <div className="space-y-4">
      {/* SESSION HEADER & STATUS */}
      <div className="ui-surface p-5 md:p-6">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0 flex-1">
            <h2 className="text-2xl md:text-3xl font-bold text-white">Session</h2>
            
            {!activeVote ? (
              <div className="mt-3">
                <span className="ui-chip-muted">No active session</span>
              </div>
            ) : (
              <div className="mt-3 space-y-3">
                <div className="flex flex-wrap items-center gap-2">
                  {activeVote?.status === VOTE_STATUS.COLLECTING && (
                    <>
                      <span className="ui-chip-blue">Collecting submissions</span>
                      <span className="text-sm text-neutral-400">
                        {formatProgress(submissionsCount, groupMemberCount)} of {groupMemberCount}
                      </span>
                    </>
                  )}
                  {activeVote?.status === VOTE_STATUS.OPEN && (
                    <>
                      <span className="ui-chip-blue">Voting open</span>
                      <span className="text-sm text-neutral-400">
                        {formatProgress(ballotsCount, groupMemberCount)} of {groupMemberCount}
                      </span>
                    </>
                  )}
                  {activeVote?.status === VOTE_STATUS.CLOSED && (
                    <span className="ui-chip-green">Results revealed</span>
                  )}
                </div>

                <div className="space-y-1">
                  {activeVote?.status === VOTE_STATUS.COLLECTING && (
                    <div className="text-sm text-neutral-300">
                      Your submission:{" "}
                      <span className="font-semibold text-white">
                        {isNoSubmission
                          ? "⊗ No Submission"
                          : mySubId
                          ? titleById(gameMap, mySubId)
                          : "—"}
                      </span>
                    </div>
                  )}
                  {activeVote?.status === VOTE_STATUS.OPEN && (
                    <div className="text-sm text-neutral-300">
                      Your vote:{" "}
                      <span className="font-semibold text-white">
                        {myBallot?.gameId ? titleById(gameMap, myBallot.gameId) : "—"}
                      </span>
                    </div>
                  )}
                  {activeVote?.status === VOTE_STATUS.CLOSED && (
                    <div className="text-sm text-neutral-300">
                      Winner:{" "}
                      <span className="font-semibold text-white">
                        {winnerRow ? winnerRow.title : "No votes cast"}
                      </span>
                    </div>
                  )}
                </div>
              </div>
            )}
          </div>

          {/* SESSION CONTROL BUTTONS */}
          <div className="flex flex-col items-end gap-2 shrink-0">
            {!activeVote && (
              <button
                className="ui-btn-primary text-sm"
                onClick={onCallSession}
              >
                Call session
              </button>
            )}

            {activeVote?.status === VOTE_STATUS.COLLECTING && canManageSession && (
              <button
                className="ui-btn-primary text-sm"
                onClick={onStartVoting}
              >
                Start voting
              </button>
            )}

            {activeVote?.status === VOTE_STATUS.OPEN && (
              <button
                className="ui-btn-primary text-sm"
                onClick={onCloseVote}
                disabled={!canCloseActiveVote}
                title={!canCloseActiveVote ? "Only session/group owner can close" : ""}
              >
                Close & reveal
              </button>
            )}

            {activeVote?.status === VOTE_STATUS.CLOSED && (
              <button
                className="ui-btn-secondary text-sm"
                onClick={onCallSession}
              >
                Next session
              </button>
            )}
          </div>
        </div>

        {/* EXPORT BUTTONS - only shown when closed */}
        {activeVote?.status === VOTE_STATUS.CLOSED && (
          <div className="mt-4 pt-4 border-t border-neutral-700 flex flex-wrap gap-2">
            <button
              className="ui-btn-secondary text-xs"
              onClick={() => onExportSession?.(activeVote.id)}
            >
              Download JSON
            </button>

            {canEmailSession && (
              <button
                className="ui-btn-secondary text-xs"
                onClick={() => onEmailSession?.(activeVote.id)}
              >
                Email JSON
              </button>
            )}
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
        <>
          {/* RESULTS SECTION */}
          <div className="ui-surface p-5 md:p-6 space-y-4">
            <h3 className="text-2xl font-bold text-white">Results</h3>

            {winnerRow ? (
              <div className="ui-surface-raised p-4 border-l-4 border-blue-500">
                <div className="text-xs uppercase tracking-wide text-neutral-400 mb-1">Selected game</div>
                <div className="text-xl font-bold text-white mb-2">🏆 {winnerRow.title}</div>
                <div className="text-sm text-neutral-300 space-y-1">
                  <div>
                    Score: <span className="font-semibold">{formatScore(winnerRow.score)}</span>
                  </div>
                  <div>
                    Votes: <span className="font-semibold">{winnerRow.votes}</span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="ui-surface-subtle p-4">
                <p className="text-sm text-neutral-400">No winner recorded (no votes cast)</p>
              </div>
            )}

            {scoredResults.length > 0 && (
              <div>
                <div className="text-xs uppercase tracking-wide text-neutral-400 mb-3">Score board</div>
                <div className="space-y-2">
                  {scoredResults.map((r) => (
                    <div
                      key={r.gameId}
                      className="ui-surface-subtle p-3 flex items-center justify-between gap-3"
                    >
                      <span className={r.isWinner ? "font-semibold text-white" : "text-neutral-300"}>
                        {r.isWinner && "🏆 "}
                        {r.title}
                      </span>
                      <div className="text-right text-sm text-neutral-400 tabular-nums">
                        <div className="font-semibold text-white">{formatScore(r.score)}</div>
                        <div className="text-xs">{r.votes} vote{r.votes === 1 ? "" : "s"}</div>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {canManageSession && (
              <div className="border-t border-neutral-700 pt-4">
                <button
                  type="button"
                  className="ui-btn-secondary text-xs"
                  onClick={() => {
                    if (isVoteOverrideOpen) {
                      setIsVoteOverrideOpen(false);
                    } else {
                      openVoteOverrideEditor();
                    }
                  }}
                >
                  {isVoteOverrideOpen ? "Cancel" : "Edit results"}
                </button>

                {isVoteOverrideOpen && (
                  <div className="mt-4 space-y-3">
                    <p className="text-xs text-neutral-400">
                      Override vote counts and winner. Original ballot data is never modified.
                    </p>

                    <div className="text-sm text-neutral-300">
                      Votes remaining:{" "}
                      <span className={overrideVotesRemaining < 0 ? "text-red-400 font-bold" : "font-semibold text-white"}>
                        {overrideVotesRemaining}
                      </span>
                      {overrideVotesRemaining < 0 && (
                        <span className="ml-2 text-xs text-red-400">Exceeds member count</span>
                      )}
                    </div>

                    {overrideDraft.length === 0 ? (
                      <p className="text-sm text-neutral-400">No vote data to override.</p>
                    ) : (
                      <div className="space-y-2">
                        {overrideDraft.map((r) => (
                          <div
                            key={r.gameId}
                            className="ui-surface-subtle p-3 flex items-center gap-3"
                          >
                            <input
                              type="radio"
                              name="override-winner"
                              checked={r.isWinner}
                              onChange={() => handleSetOverrideWinner(r.gameId)}
                              className="shrink-0"
                              title="Mark as winner"
                            />
                            <span className="flex-1 text-sm text-neutral-200 min-w-0 truncate">
                              {r.isWinner && "🏆 "}{r.title}
                            </span>
                            <input
                              type="number"
                              min="0"
                              max={groupMemberCount}
                              value={r.votes}
                              onChange={(e) => handleSetOverrideVotes(r.gameId, e.target.value)}
                              className="w-20 text-sm text-right"
                            />
                            <span className="text-xs text-neutral-500 shrink-0">votes</span>
                          </div>
                        ))}
                      </div>
                    )}

                    <div className="flex gap-2 pt-1">
                      <button
                        type="button"
                        className="ui-btn-primary text-sm"
                        disabled={isSavingVoteOverride || overrideVotesRemaining < 0}
                        onClick={handleSaveVoteOverride}
                      >
                        {isSavingVoteOverride ? "Saving…" : "Save"}
                      </button>
                      <button
                        type="button"
                        className="ui-btn-secondary text-sm"
                        onClick={() => setIsVoteOverrideOpen(false)}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}
          </div>

          {/* SESSION HISTORY EDITING FORM */}
          <div className="ui-surface p-5 md:p-6 space-y-4">
            <div className="border-b border-neutral-700 pb-4">
              <h3 className="text-lg font-semibold text-white">Record session details</h3>
              <p className="text-sm text-neutral-400 mt-1">
                Log what was played and the outcomes for your group's archive.
              </p>
            </div>

            <div>
              <label className="ui-field-label">Played date</label>
              <input
                type="date"
                value={historyPlayedDate}
                onChange={(e) => setHistoryPlayedDate(e.target.value)}
                className="w-full"
              />
            </div>

            <div className="space-y-3">
              <div>
                <div className="ui-field-label">Primary game</div>
                {winnerGameId ? (
                  <div className="ui-surface-subtle p-3 rounded-xl">
                    <div className="text-sm font-medium text-white">{titleById(gameMap, winnerGameId)}</div>
                    <div className="text-xs text-neutral-400 mt-1">Winner (auto-filled)</div>
                  </div>
                ) : (
                  <div className="ui-surface-subtle p-3 rounded-xl">
                    <p className="text-sm text-neutral-400">No winner recorded for this session</p>
                  </div>
                )}
              </div>

              <div>
                <div className="ui-field-label">Additional games played</div>
                <div className="ui-field-hint mb-3">
                  Select any other games the group played during this session.
                </div>

                <div className="ui-surface-subtle border rounded-xl overflow-hidden">
                  <div className="max-h-60 overflow-y-auto">
                    {historyOptions
                      .filter((g) => g.id !== winnerGameId)
                      .map((g) => {
                        const checked = historyPlayedGameIds.includes(g.id);
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
                      })}
                  </div>
                </div>
              </div>

              <div>
                <div className="ui-field-label">Result type</div>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {SESSION_RESULT_MODE_OPTIONS.map((option) => {
                    const selected = historyResultMode === option.value;
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
                          const alreadySelected = historyParticipantIds.includes(userId);
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
                                    {String(result?.nickname || "").trim() || truncateUserId(userId)}
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

              {historyResultMode === "ranked" && (
                <div className="ui-surface-subtle border rounded-xl">
                  <div className="px-3 py-2 border-b border-neutral-700">
                    <div className="ui-field-hint">
                      Assign placements, or leave players unassigned. Ties are supported.
                    </div>
                  </div>

                  {participantOptions.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-neutral-400">No participants available.</div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      {participantOptions.map((participant) => {
                        const selectedPlacement = historyPlacements.find(
                          (entry) => entry.userId === participant.userId
                        );
                        const avatar = resolveAvatar(participant.avatarId);

                        return (
                          <div
                            key={participant.userId}
                            className="flex items-center justify-between gap-3 px-3 py-3 border-b border-neutral-700 last:border-b-0"
                          >
                            <div className="flex items-center gap-2 min-w-0">
                              <span className="h-6 w-6 overflow-hidden rounded-full border border-neutral-600 bg-neutral-800 flex items-center justify-center text-xs shrink-0">
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
                              <span className="text-sm text-neutral-300 min-w-0 truncate">
                                {participant.label}
                                {!participant.isMember && " (Guest)"}
                              </span>
                            </div>

                            <select
                              className="text-sm"
                              value={selectedPlacement?.place || ""}
                              onChange={(e) => {
                                const rawValue = e.target.value;
                                setRankedPlacement(
                                  participant.userId,
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
                <div className="ui-surface-subtle border rounded-xl">
                  <div className="px-3 py-2 border-b border-neutral-700">
                    <div className="ui-field-hint">Select the players who won together.</div>
                  </div>

                  {participantOptions.length === 0 ? (
                    <div className="px-3 py-3 text-sm text-neutral-400">No participants available.</div>
                  ) : (
                    <div className="max-h-72 overflow-y-auto">
                      {participantOptions.map((participant) => {
                        const checked = historyPlacements.some(
                          (entry) => entry.userId === participant.userId
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

              {historyResultMode === "coop-loss" && (
                <div className="ui-surface-subtle p-4 rounded-xl">
                  <p className="text-sm text-neutral-300">This session will be recorded as a co-op loss.</p>
                </div>
              )}

              {historyResultMode === "no-winner" && (
                <div className="ui-surface-subtle p-4 rounded-xl">
                  <p className="text-sm text-neutral-300">This session will be recorded with no player winner.</p>
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
                  {historyMetrics.length === 0 ? (
                    <div className="text-sm text-neutral-400">No custom metrics added.</div>
                  ) : (
                    historyMetrics.map((entry, index) => (
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
            </div>

            <div className="pt-2 border-t border-neutral-700">
              <button
                type="button"
                className="ui-btn-primary w-full text-sm"
                onClick={handleSaveSessionPlay}
                disabled={!canManageSession || isSavingSessionPlay}
                title={!canManageSession ? "Only session/group owner can save" : ""}
              >
                {isSavingSessionPlay ? "Saving session…" : "Save session details"}
              </button>
            </div>
          </div>
        </>
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
              const playParticipantIds = normalizeParticipantIds(play.participantIds, groupMemberIds);
              const playPlacements = normalizeParticipantPlacements(
                play.placements,
                playResultMode,
                playParticipantIds
              );
              const playParticipantMap = new Map(
                playParticipantIds.map((userId) => {
                  const summary = participantSummaryById?.[userId] || null;
                  if (summary?.label) {
                    return [userId, { nickname: summary.label }];
                  }
                  return [userId, memberMap.get(userId) || { userId }];
                })
              );
              const resultSummary = formatPlacementsSummary(
                playResultMode,
                playPlacements,
                playParticipantMap
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
        bottom={isDesktopViewport ? 16 : 96}
        onClick={handleSubmit}
      >
        {hasSubmitted ? "Change" : "Submit"}
      </Fab>

      <Fab
        show={activeVote?.status === VOTE_STATUS.OPEN}
        variant="pill"
        label={alreadyVoted ? "Voted" : "Vote"}
        disabled={voteDisabled}
        bottom={isDesktopViewport ? 16 : 96}
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