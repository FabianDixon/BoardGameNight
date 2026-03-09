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

function VotingPanelInner({
  user,
  currentGroupId,
  groupSettings,
  groupGames,

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

  return (
    <div className="space-y-4">
      <div className="bg-white rounded-2xl shadow border p-4">
        <h2 className="text-2xl font-bold">Session</h2>
        <div className="mt-2 text-sm text-gray-700">
          Active:{" "}
          <span className="font-semibold">
            {activeVote ? `Session (${activeVote.status || "?"})` : "—"}
          </span>
        </div>

        {activeVote?.status === VOTE_STATUS.COLLECTING && (
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="px-2 py-1 rounded-full border bg-gray-50">
              Submissions: <span className="font-semibold tabular-nums">
                {formatProgress(submissionsCount, groupMemberCount)}
              </span>
            </span>

            {isNoSubmission && (
              <span className="px-2 py-1 rounded-full border bg-blue-50 text-blue-800">
                ⊗ No Submission
              </span>
            )}

            {mySubId && !isNoSubmission && (
              <span className="px-2 py-1 rounded-full border bg-green-50 text-green-800">
                ✅ Submitted
              </span>
            )}
          </div>
        )}

        {activeVote?.status === VOTE_STATUS.OPEN && (
          <div className="mt-2 flex flex-wrap gap-2 text-sm">
            <span className="px-2 py-1 rounded-full border bg-gray-50">
              Votes: <span className="font-semibold tabular-nums">
                {formatProgress(ballotsCount, groupMemberCount)}
              </span>
            </span>

            {alreadyVoted && (
              <span className="px-2 py-1 rounded-full border bg-green-50 text-green-800">
                ✅ Voted
              </span>
            )}
          </div>
        )}

        <div className="mt-3 flex flex-wrap gap-2">
          {!activeVote && (
            <button
              className="px-4 py-2 rounded-xl border bg-white"
              onClick={onCallSession}
            >
              Call session
            </button>
          )}

          {activeVote?.status === VOTE_STATUS.COLLECTING && canManageSession && (
            <button
              className="px-4 py-2 rounded-xl border bg-white"
              onClick={onStartVoting}
            >
              Start voting
            </button>
          )}

          {activeVote?.status === VOTE_STATUS.OPEN && (
            <button
              className="px-4 py-2 rounded-xl border bg-white"
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
                className="px-4 py-2 rounded-xl border bg-white"
                onClick={() => onExportSession?.(activeVote.id)}
              >
                Download JSON
              </button>

              {canEmailSession && (
                <button
                  className="px-4 py-2 rounded-xl border bg-white"
                  onClick={() => onEmailSession?.(activeVote.id)}
                >
                  Email JSON
                </button>
              )}

              <button
                className="px-4 py-2 rounded-xl border bg-white"
                onClick={onCallSession}
              >
                Call next session
              </button>
            </>
          )}
        </div>

        {activeVote?.status === VOTE_STATUS.COLLECTING && (
          <div className="mt-4 text-sm text-gray-700">
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
          <div className="mt-4 text-sm text-gray-700">
            Your vote:{" "}
            <span className="font-semibold">
              {myBallot?.gameId ? titleById(gameMap, myBallot.gameId) : "—"}
            </span>
          </div>
        )}
      </div>

      {activeVote?.status === VOTE_STATUS.COLLECTING && (
        <div className="bg-white rounded-2xl shadow border p-4 space-y-3 pb-28">
          <h3 className="text-xl font-semibold">Submit one game</h3>
          <p className="text-sm text-gray-600">
            Select a game and press <span className="font-semibold">Submit</span>, or choose{" "}
            <span className="font-semibold">No Submission</span> if you don't want to submit a game this round.
          </p>

          <button
            type="button"
            onClick={onSubmitNoSubmission}
            disabled={!canSubmit}
            className="w-full px-4 py-3 rounded-xl border-2 border-dashed border-gray-300 bg-gray-50 hover:bg-gray-100 hover:border-gray-400 transition text-sm font-medium text-gray-700 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            ⊗ {isNoSubmission ? "Already marked as no submission" : "No Submission"}
          </button>

          <input
            type="text"
            placeholder="Search by title..."
            value={phaseSearch}
            onChange={(e) => setPhaseSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
        
          {filteredSubmissionGames.length === 0 ? (
            <p className="text-sm text-gray-600">No matches for “{phaseSearch}”.</p>
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
        <div className="bg-white rounded-2xl shadow border p-4 space-y-3 pb-28">
          <h3 className="text-xl font-semibold">Cast your vote</h3>
          <p className="text-sm text-gray-600">
            Select a game, then press <span className="font-semibold">Vote</span>. Your vote is secret until revealed.
          </p>

          <input
            type="text"
            placeholder="Search by title..."
            value={phaseSearch}
            onChange={(e) => setPhaseSearch(e.target.value)}
            className="w-full border rounded-lg px-3 py-2 text-sm"
          />
          {filteredCandidateIds.length === 0 ? (
            <p className="text-sm text-gray-600">No matches for “{phaseSearch}”.</p>
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
        <div className="bg-white rounded-2xl shadow border p-4 space-y-3">
          <h3 className="text-xl font-semibold">Results</h3>

          {winnerRow ? (
            <div className="p-3 rounded-xl border bg-gray-50">
              <div className="text-sm text-gray-600">Winner</div>
              <div className="text-lg font-semibold flex items-center gap-2">
                {winnerRow.title}
                <span className="text-xs px-2 py-0.5 rounded-full border bg-white">
                  🏆 Winner
                </span>
              </div>

              <div className="text-sm text-gray-700 mt-1">
                Score:{" "}
                <span className="font-semibold tabular-nums">
                  {formatScore(winnerRow.score)}
                </span>
                {" · "}
                Votes: <span className="tabular-nums">{winnerRow.votes}</span>
              </div>
            </div>
          ) : (
            <p className="text-sm text-gray-600">No winner recorded (no votes cast).</p>
          )}

          <div>
            <div className="text-sm font-semibold mb-2">Scores</div>
            {scoredResults.length === 0 ? (
              <p className="text-sm text-gray-600">No results.</p>
            ) : (
              <ul className="text-sm space-y-1">
                {scoredResults.map((r) => (
                  <li
                    key={r.gameId}
                    className="flex items-center justify-between gap-3"
                  >
                    <span className={r.isWinner ? "font-semibold" : ""}>
                      {r.isWinner ? "🏆 " : ""}
                      {r.title}
                    </span>
                    <span className="tabular-nums text-gray-700">
                      {formatScore(r.score)}
                      <span className="text-gray-500">
                        {" "}
                        · {r.votes} vote{r.votes === 1 ? "" : "s"}
                      </span>
                    </span>
                  </li>
                ))}
              </ul>
            )}
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
  const phaseKey = `${props.activeVote?.id || "no-vote"}:${props.activeVote?.status || "none"}`;
  return <VotingPanelInner key={phaseKey} {...props} />;
}