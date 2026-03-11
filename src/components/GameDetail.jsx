// src/components/GameDetail.jsx
import CollectionToggle from "./CollectionToggle";
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

  return (
    <div className="ui-surface p-6 max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <button className="text-sm text-blue-400 hover:underline" onClick={onBack}>
          ← Back
        </button>

        {canEdit && (
          <button
            className="ui-btn-secondary px-3 py-1"
            onClick={onEdit}
            title="Edit game"
            aria-label="Edit game"
          >
            ✏️
          </button>
        )}
      </div>

      {game.imageUrl && (
      <div className="w-full flex justify-center bg-neutral-900 rounded-2xl overflow-hidden mb-4">
        <img
          src={game.imageUrl}
          alt={game.title}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="block object-contain"
          style={{
            maxHeight: "70vh",     // never taller than viewport
            maxWidth: "100%",      // never wider than container
            width: "auto",         // ❗ do not stretch
            height: "auto",        // ❗ do not stretch
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      </div>
    )}

      <h2 className="text-2xl font-bold text-white">{game.title}</h2>
      <p className="mt-2 text-gray-300">{game.description}</p>

      <div className="mt-4">
        <div className="text-sm font-medium text-gray-200 mb-2">Tags</div>
        {tags.length > 0 ? (
          <div className="flex flex-wrap gap-2">
            {tags.map((tag) => (
              <span
                key={tag}
                className="ui-chip-muted text-sm"
              >
                {getGameTagLabel(tag)}
              </span>
            ))}
          </div>
        ) : (
          <p className="text-sm text-gray-400">No tags yet.</p>
        )}
      </div>

      <div className="mt-4">
        <p className="text-yellow-400 text-sm mb-1">
          Average rating: {averageRating(game)}
        </p>

        <p className="text-sm text-gray-300 mb-2">
          Your rating:{" "}
          <span className="font-semibold">{myRating ?? "—"}</span>
        </p>

        <StarRating value={myRating || 0} onChange={(v) => onRate(v)} readOnly={false} />
      </div>

      <div className="mt-6">
        <CollectionToggle inCollection={inCollection} onAdd={onAdd} onRemove={onRemove} />
      </div>

      {groupId && (
        <div className="mt-4 p-3 rounded-xl border border-neutral-700 bg-neutral-900">
          <div className="text-sm font-semibold mb-2 text-white">This group</div>

          {!inCollection ? (
            <p className="text-sm text-gray-300">
              Add this game to your collection to be able to share it with this group.
            </p>
          ) : (
            <div className="flex items-center justify-between gap-3">
              <div className="min-w-0">
                <div className="text-sm text-gray-300">
                  Shared by you:{" "}
                  <span className="font-semibold">
                    {sharedInGroup == null ? "…" : sharedInGroup ? "Yes" : "No"}
                  </span>
                </div>
                <div className="text-xs text-gray-400">
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