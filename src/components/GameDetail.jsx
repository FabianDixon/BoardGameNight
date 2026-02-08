// src/components/GameDetail.jsx
import React from "react";
import CollectionToggle from "./CollectionToggle";
import StarRating from "./StarRating";

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
}) {
  return (
    <div className="bg-white rounded-2xl shadow p-6 max-w-xl">
      <div className="flex items-center justify-between mb-4">
        <button className="text-sm text-blue-700 hover:underline" onClick={onBack}>
          ← Back
        </button>

        {canEdit && (
          <button
            className="text-sm border rounded px-3 py-1 bg-white hover:bg-gray-50"
            onClick={onEdit}
            title="Edit game"
            aria-label="Edit game"
          >
            ✏️
          </button>
        )}
      </div>

      {game.imageUrl && (
      <div className="w-full flex justify-center bg-gray-100 rounded-2xl overflow-hidden mb-4">
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

      <h2 className="text-2xl font-bold">{game.title}</h2>
      <p className="mt-2 text-gray-700">{game.description}</p>

      <div className="mt-4">
        <p className="text-yellow-700 text-sm mb-1">
          Average rating: {averageRating(game)}
        </p>

        <p className="text-sm text-gray-700 mb-2">
          Your rating:{" "}
          <span className="font-semibold">{myRating ?? "—"}</span>
        </p>

        <StarRating value={myRating || 0} onChange={(v) => onRate(v)} readOnly={false} />
      </div>

      <div className="mt-6">
        <CollectionToggle inCollection={inCollection} onAdd={onAdd} onRemove={onRemove} />
      </div>
    </div>
  );
}