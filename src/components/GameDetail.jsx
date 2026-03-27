// src/components/GameDetail.jsx
import { useEffect, useMemo, useState } from "react";
import StarRating from "./StarRating";
import { getGameTagLabel, normalizeGameTags } from "../utils/gameTags";

function averageRating(game) {
  if (!game?.ratingCount) return "–";
  return (game.ratingTotal / game.ratingCount).toFixed(1);
}

export default function GameDetail({
  game,
  inCollection,
  myRating,
  canRate = true,
  onRequireSavedAccount,
  onBack,
  onRate,
  onAdd,
  onRemove,
  canEdit,
  onEdit,
  // Optional: when opened from a group context
  groupId,
  sharedInGroup,
  onToggleShareInGroup,
  shareBusy,
}) {
  const tags = normalizeGameTags(game?.tags);
  const initialSavedRating = useMemo(() => {
    const value = Number(myRating);
    return Number.isFinite(value) && value >= 0.5 && value <= 5 ? value : 0;
  }, [myRating]);
  const [savedRating, setSavedRating] = useState(initialSavedRating);
  const [draftRating, setDraftRating] = useState(initialSavedRating);
  const [isSavingRating, setIsSavingRating] = useState(false);

  useEffect(() => {
    setSavedRating(initialSavedRating);
    setDraftRating(initialSavedRating);
  }, [game?.id, initialSavedRating]);

  const hasPendingRatingChanges = draftRating !== savedRating;

  async function saveDraftRating(valueOverride = draftRating) {
    if (!canRate || isSavingRating) return;
    setIsSavingRating(true);
    try {
      await onRate?.(valueOverride);
      setSavedRating(valueOverride);
      setDraftRating(valueOverride);
    } finally {
      setIsSavingRating(false);
    }
  }

  return (
    <div className="mx-auto mt-4 md:mt-5 w-full max-w-4xl space-y-5">
      <div className="flex items-center justify-between">
        <button className="ui-btn-ghost px-3 py-1.5 text-xs" onClick={onBack}>
          ← Back
        </button>

        {canEdit && (
          <button
            className="ui-btn-secondary px-3 py-1.5 text-xs"
            onClick={onEdit}
            title="Edit game"
            aria-label="Edit game"
          >
            Edit
          </button>
        )}
      </div>

      <div className="ui-surface overflow-hidden p-0">
        <div className="relative flex min-h-[38vh] max-h-[72vh] items-center justify-center border-b border-neutral-700 bg-neutral-900">
          {game.imageUrl ? (
            <img
              src={game.imageUrl}
              alt={game.title}
              loading="lazy"
              referrerPolicy="no-referrer"
              className="block object-contain"
              style={{
                maxHeight: "70vh",
                maxWidth: "100%",
                width: "auto",
                height: "auto",
              }}
              onError={(e) => {
                e.currentTarget.style.display = "none";
              }}
            />
          ) : (
            <span className="text-xs uppercase tracking-wide text-neutral-500">No cover available</span>
          )}

          <div className="pointer-events-none absolute inset-x-0 bottom-0 h-20 bg-gradient-to-t from-black/45 to-transparent" />
        </div>

        <div className="space-y-4 p-5 md:p-6">
          <div className="space-y-3">
            <h2 className="text-3xl md:text-4xl font-bold tracking-tight text-white">{game.title}</h2>

            <div className="flex flex-wrap items-center gap-2">
              <span className="ui-chip-yellow">⭐ Avg {averageRating(game)}</span>
              <span className="ui-chip-muted">Your rating: {savedRating || "—"}</span>
              {inCollection ? <span className="ui-chip-green">In your collection</span> : null}
            </div>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-widest uppercase text-neutral-400">About</h3>
            <p className="text-sm md:text-base leading-relaxed text-neutral-200">
              {game.description || "No description added yet."}
            </p>
          </div>

          <div className="space-y-2">
            <h3 className="text-xs font-semibold tracking-widest uppercase text-neutral-400">Tags</h3>
            {tags.length > 0 ? (
              <div className="flex flex-wrap gap-2">
                {tags.map((tag) => (
                  <span
                    key={tag}
                    className="ui-chip-muted"
                  >
                    {getGameTagLabel(tag)}
                  </span>
                ))}
              </div>
            ) : (
              <p className="text-sm text-neutral-400">No tags yet.</p>
            )}
          </div>

          <div className="space-y-3 pt-1">
            <div className="space-y-2">
              <p className="text-sm text-neutral-300">Rate this game</p>
              {canRate ? (
                <div className="flex flex-wrap items-center justify-between gap-3">
                  <StarRating
                    value={draftRating}
                    onChange={(v) => setDraftRating(v)}
                    allowClearOnRepeat
                    readOnly={isSavingRating}
                  />
                  {hasPendingRatingChanges && (
                    <button
                      type="button"
                      className="ui-btn-secondary px-3 py-1.5 text-xs"
                      onClick={() => saveDraftRating()}
                      disabled={isSavingRating}
                    >
                      {isSavingRating ? "Saving…" : "Save"}
                    </button>
                  )}
                </div>
              ) : (
                <div className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5 space-y-2">
                  <p className="text-sm text-neutral-300">Create an account to rate games.</p>
                  <button
                    type="button"
                    className="ui-btn-secondary px-3 py-1.5 text-xs"
                    onClick={onRequireSavedAccount}
                  >
                    Create account to rate games
                  </button>
                </div>
              )}
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3 border-t border-neutral-700/70 pt-3">
              <p className="text-sm text-neutral-300"></p>
              <button
                type="button"
                className={inCollection ? "ui-btn-danger px-3 py-1.5 text-xs" : "ui-btn-success px-3 py-1.5 text-xs"}
                onClick={inCollection ? onRemove : onAdd}
              >
                {inCollection ? "Remove from my collection" : "Add to my collection"}
              </button>
            </div>
          </div>
        </div>
      </div>

      {groupId && (
        <div className="ui-surface-subtle p-4">
          <div className="text-xs font-semibold tracking-widest uppercase text-neutral-400 mb-2">Group relevance</div>

          {!inCollection ? (
            <p className="text-sm text-neutral-300">
              Add this game to your collection to be able to share it with this group.
            </p>
          ) : (
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-neutral-300">
                  Shared by you:{" "}
                  <span className="font-semibold">
                    {sharedInGroup == null ? "…" : sharedInGroup ? "Yes" : "No"}
                  </span>
                </div>
                <div className="text-xs text-neutral-400">
                  Controls whether this game appears in the group collection because of you.
                </div>
              </div>

              <button
                type="button"
                className={`ui-btn ${
                  sharedInGroup ? "ui-btn-secondary" : "ui-btn-primary"
                } disabled:opacity-50`}
                disabled={!onToggleShareInGroup || !!shareBusy || sharedInGroup == null}
                onClick={() => onToggleShareInGroup(!(sharedInGroup === true))}
              >
                {shareBusy || sharedInGroup == null
                  ? "Saving…"
                  : sharedInGroup
                  ? "Hide from group"
                  : "Share with group"}
              </button>
            </div>
          )}
        </div>
      )}
    </div>
  );
}