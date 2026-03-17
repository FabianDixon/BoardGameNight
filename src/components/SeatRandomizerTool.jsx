import { useMemo, useState } from "react";

function shuffle(array) {
  const next = [...array];
  for (let i = next.length - 1; i > 0; i -= 1) {
    const j = Math.floor(Math.random() * (i + 1));
    [next[i], next[j]] = [next[j], next[i]];
  }
  return next;
}

function displayNameForMember(member) {
  const nickname = String(member?.nickname || "").trim();
  if (nickname) return nickname;

  const userId = String(member?.userId || "").trim();
  if (!userId) return "Unknown member";
  if (userId.length <= 12) return userId;

  return `${userId.slice(0, 6)}…${userId.slice(-4)}`;
}

export default function SeatRandomizerTool({ members }) {
  const participants = useMemo(() => {
    return (members || []).map((member) => ({
      id: String(member?.userId || "").trim(),
      label: displayNameForMember(member),
    })).filter((participant) => participant.id);
  }, [members]);

  const [excludedIds, setExcludedIds] = useState(() => new Set());
  const [seatOrder, setSeatOrder] = useState([]);

  const includedParticipants = useMemo(
    () => participants.filter((participant) => !excludedIds.has(participant.id)),
    [participants, excludedIds]
  );

  const labelById = useMemo(() => {
    const map = new Map();
    for (const participant of participants) map.set(participant.id, participant.label);
    return map;
  }, [participants]);

  const canRandomize = includedParticipants.length > 0;
  const visibleSeatOrder = useMemo(
    () => seatOrder.filter((participantId) => labelById.has(participantId)),
    [seatOrder, labelById]
  );
  const hasResult = visibleSeatOrder.length > 0;

  const onRandomize = () => {
    if (!canRandomize) return;
    setSeatOrder(shuffle(includedParticipants.map((participant) => participant.id)));
  };

  return (
    <div className="ui-surface p-4 md:p-5 space-y-4">
      <div>
        <h3 className="text-xl font-semibold text-white">Seat randomizer</h3>
        <p className="text-sm text-neutral-400 mt-1">
          Pick who is in for this shuffle, then generate a random seating/play order.
        </p>
      </div>

      {participants.length === 0 ? (
        <p className="text-sm text-neutral-300">No group members found yet.</p>
      ) : (
        <>
          <div className="space-y-2">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Participants</div>
            <div className="space-y-2">
              {participants.map((participant) => {
                const isIncluded = !excludedIds.has(participant.id);

                return (
                  <div
                    key={participant.id}
                    className="flex items-center justify-between gap-3 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2"
                  >
                    <span className="text-sm text-neutral-100 truncate">{participant.label}</span>
                    <button
                      type="button"
                      className={`ui-pill text-xs whitespace-nowrap ${
                        isIncluded ? "ui-pill-active" : "ui-pill-inactive"
                      }`}
                      onClick={() => {
                        setExcludedIds((prev) => {
                          const next = new Set(prev);
                          if (isIncluded) next.add(participant.id);
                          else next.delete(participant.id);
                          return next;
                        });
                      }}
                    >
                      {isIncluded ? "Included" : "Excluded"}
                    </button>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="ui-btn-primary px-4 py-2"
              onClick={onRandomize}
              disabled={!canRandomize}
            >
              {hasResult ? "Randomize again" : "Randomize"}
            </button>
            <span className="text-xs text-neutral-400">
              {includedParticipants.length} included
            </span>
          </div>

          {!canRandomize && (
            <p className="text-sm text-neutral-300">
              Include at least one member to randomize.
            </p>
          )}

          {hasResult && (
            <div className="space-y-2">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Randomized order</div>
              <ol className="space-y-2">
                {visibleSeatOrder.map((participantId, index) => (
                  <li
                    key={`${participantId}-${index}`}
                    className="flex items-center gap-3 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2"
                  >
                    <span className="ui-chip-muted min-w-8 justify-center">{index + 1}</span>
                    <span className="text-sm text-neutral-100 truncate">
                      {labelById.get(participantId) || participantId}
                    </span>
                  </li>
                ))}
              </ol>
            </div>
          )}
        </>
      )}
    </div>
  );
}
