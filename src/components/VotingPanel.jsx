// src/components/VotingPanel.jsx
import { useMemo, useState } from "react";

function byScoreDesc(a, b) {
  return (b.score || 0) - (a.score || 0);
}

function formatScore(n) {
  const x = Number(n || 0);
  return x.toFixed(2);
}

function titleById(gameMap, id) {
  return gameMap.get(id)?.title || id;
}

function VotingPanelInner({
  user,
  currentGroupId,
  groupGames,

  activeVote,
  mySubmissionGameId,
  myBallot,
  results,

  onCallSession,
  onSubmitGame,
  onStartVoting,
  onCastVote,
  onCloseVote,
  onExportSession,

  canManageSession,
  canCloseActiveVote,
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

  // Local selection for 2-step confirm flow (select -> submit/vote)
  const [selectedSubmissionId, setSelectedSubmissionId] = useState(null);
  const [selectedVoteId, setSelectedVoteId] = useState(null);

  const canSubmit = !!user && !!currentGroupId && status === "collecting";
  const canVote = !!user && !!currentGroupId && status === "open";

  const alreadySubmitted = !!mySubmissionGameId;
  const alreadyVoted = !!myBallot?.gameId;

  const submitDisabled = !canSubmit || alreadySubmitted || !selectedSubmissionId;
  const voteDisabled = !canVote || alreadyVoted || !selectedVoteId;

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
    await onSubmitGame(selectedSubmissionId);
    setSelectedSubmissionId(null);
  }

  async function handleVote() {
    if (voteDisabled) return;
    await onCastVote(selectedVoteId);
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

        <div className="mt-3 flex flex-wrap gap-2">
          {!activeVote && (
            <button
              className="px-4 py-2 rounded-xl border bg-white"
              onClick={onCallSession}
            >
              Call session
            </button>
          )}

          {activeVote?.status === "collecting" && canManageSession && (
            <button
              className="px-4 py-2 rounded-xl border bg-white"
              onClick={onStartVoting}
            >
              Start voting
            </button>
          )}

          {activeVote?.status === "open" && (
            <button
              className="px-4 py-2 rounded-xl border bg-white"
              onClick={onCloseVote}
              disabled={!canCloseActiveVote}
              title={!canCloseActiveVote ? "Only session/group owner can close" : ""}
            >
              Close & reveal
            </button>
          )}

          {activeVote?.status === "closed" && (
            <>
              <button
                className="px-4 py-2 rounded-xl border bg-white"
                onClick={() => onExportSession?.(activeVote.id)}
              >
                Export session JSON
              </button>
              <button
                className="px-4 py-2 rounded-xl border bg-white"
                onClick={onCallSession}
              >
                Call next session
              </button>
            </>
          )}
        </div>

        {activeVote?.status === "collecting" && (
          <div className="mt-4 text-sm text-gray-700">
            Your submission:{" "}
            <span className="font-semibold">
              {mySubmissionGameId ? titleById(gameMap, mySubmissionGameId) : "—"}
            </span>
          </div>
        )}

        {activeVote?.status === "open" && (
          <div className="mt-4 text-sm text-gray-700">
            Your vote:{" "}
            <span className="font-semibold">
              {myBallot?.gameId ? titleById(gameMap, myBallot.gameId) : "—"}
            </span>
          </div>
        )}
      </div>

      {activeVote?.status === "collecting" && (
        <div className="bg-white rounded-2xl shadow border p-4 space-y-3">
          <h3 className="text-xl font-semibold">Submit one game</h3>
          <p className="text-sm text-gray-600">
            Select a game, then press <span className="font-semibold">Submit</span>. You can only submit once.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 items-start">
            {groupGames.map((g) => {
              const selected = selectedSubmissionId === g.id;
              const submitted = mySubmissionGameId === g.id;

              return (
                <button
                  key={g.id}
                  className={[
                    "text-left rounded-2xl border transition w-full relative touch-manipulation active:scale-100",
                    // base background
                    selected ? "bg-blue-50" : "bg-gray-50 hover:bg-gray-100",
                    // hover ring for clarity (even when not selected)
                    !selected ? "hover:outline hover:outline-2 hover:outline-blue-200 hover:outline-offset-2 hover:border-blue-300" : "",
                    // sticky selected ring
                    selected ? "outline outline-4 outline-blue-500 outline-offset-2 border-blue-500"
                    : "border-gray-200",
                    // disabled styling
                    alreadySubmitted ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                  onClick={() => {
                    if (alreadySubmitted) return;
                    setSelectedSubmissionId(g.id);
                  }}
                  disabled={alreadySubmitted}
                >
                  <div className="aspect-square w-full bg-gray-200 overflow-hidden flex items-center justify-center">
                    {g.imageUrl ? (
                      <img
                        src={g.imageUrl}
                        alt={g.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        draggable={false}
                        className="pointer-events-none select-none"
                        style={{
                          display: "block",
                          maxWidth: "100%",
                          maxHeight: "100%",
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                          objectPosition: "center",

                          // stop any hover/active zoom rules
                          transform: "none",
                          transition: "none",

                          // iOS/Safari: stop long-press drag/callout
                          WebkitUserDrag: "none",
                          WebkitTouchCallout: "none",
                          userSelect: "none",
                        }}
                      />
                    ) : null}
                  </div>

                  <div className="p-2">
                    <div className="text-sm font-semibold truncate flex items-center gap-2">
                      {g.title}
                      {submitted ? (
                        <span className="text-xs px-2 py-0.5 rounded-full border">
                          Submitted
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              className={[
                "px-4 py-2 rounded-xl border",
                submitDisabled ? "bg-gray-100 text-gray-400" : "bg-white hover:bg-gray-50",
              ].join(" ")}
              disabled={submitDisabled}
              onClick={handleSubmit}
              title={alreadySubmitted ? "You already submitted." : ""}
            >
              Submit
            </button>
          </div>
        </div>
      )}

      {activeVote?.status === "open" && (
        <div className="bg-white rounded-2xl shadow border p-4 space-y-3">
          <h3 className="text-xl font-semibold">Cast your vote</h3>
          <p className="text-sm text-gray-600">
            Select a game, then press <span className="font-semibold">Vote</span>. Your vote is secret until revealed.
          </p>

          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-3 items-start">
            {candidateIds.map((id) => {
              const g = gameMap.get(id) || { id, title: id, imageUrl: "" };
              const selected = selectedVoteId === id;
              const voted = myBallot?.gameId === id;

              return (
                <button
                  key={id}
                  className={[
                    "text-left rounded-2xl border transition w-full relative touch-manipulation active:scale-100",
                    // base background
                    selected ? "bg-blue-50" : "bg-gray-50 hover:bg-gray-100",
                    // hover ring for clarity (even when not selected)
                    !selected ? "hover:outline hover:outline-2 hover:outline-blue-200 hover:outline-offset-2 hover:border-blue-300" : "",
                    // sticky selected ring
                    selected ? "outline outline-4 outline-blue-500 outline-offset-2 border-blue-500"
                    : "border-gray-200",
                    // disabled styling
                    alreadyVoted ? "opacity-70 cursor-not-allowed" : "cursor-pointer",
                  ].join(" ")}
                  onClick={() => {
                    if (alreadyVoted) return;
                    setSelectedVoteId(id);
                  }}
                  disabled={alreadyVoted}
                >
                  <div className="aspect-square w-full bg-gray-200 overflow-hidden flex items-center justify-center">
                    {g.imageUrl ? (
                      <img
                        src={g.imageUrl}
                        alt={g.title}
                        loading="lazy"
                        referrerPolicy="no-referrer"
                        draggable={false}
                        className="pointer-events-none select-none"
                        style={{
                          display: "block",
                          maxWidth: "100%",
                          maxHeight: "100%",
                          width: "auto",
                          height: "auto",
                          objectFit: "contain",
                          objectPosition: "center",

                          // stop any hover/active zoom rules
                          transform: "none",
                          transition: "none",

                          // iOS/Safari: stop long-press drag/callout
                          WebkitUserDrag: "none",
                          WebkitTouchCallout: "none",
                          userSelect: "none",
                        }}
                      />
                    ) : null}
                  </div>

                  <div className="p-2">
                    <div className="text-sm font-semibold truncate flex items-center gap-2">
                      {g.title}
                      {voted ? (
                        <span className="text-xs px-2 py-0.5 rounded-full border">
                          Voted
                        </span>
                      ) : null}
                    </div>
                  </div>
                </button>
              );
            })}
          </div>

          <div className="flex justify-end">
            <button
              className={[
                "px-4 py-2 rounded-xl border",
                voteDisabled ? "bg-gray-100 text-gray-400" : "bg-white hover:bg-gray-50",
              ].join(" ")}
              disabled={voteDisabled}
              onClick={handleVote}
              title={alreadyVoted ? "You already voted." : ""}
            >
              Vote
            </button>
          </div>
        </div>
      )}

      {activeVote?.status === "closed" && (
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
    </div>
  );
}

export default function VotingPanel(props) {
  const phaseKey = `${props.activeVote?.id || "no-vote"}:${props.activeVote?.status || "none"}`;
  return <VotingPanelInner key={phaseKey} {...props} />;
}