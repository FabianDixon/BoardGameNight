// src/components/GameTile.jsx
import GameImage from "./GameImage";

export default function GameTile({
  game,
  selected = false,
  disabled = false,
  showNew = false,
  inPool = false,
  onClick,
  className = "",
}) {
  const imgSrc = game.imageThumbUrl || game.imageUrl || null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        "relative w-full rounded-xl transition",
        selected
          ? "outline outline-4 outline-blue-500"
          : "outline outline-1 outline-gray-700",
        disabled ? "opacity-40 pointer-events-none" : "hover:outline-blue-300",
        className,
      ].join(" ")}
    >
      {imgSrc ? (
        <div className="relative">
          <GameImage
            src={imgSrc}
            alt={game.title}
            variant="square"
            className="bg-gray-800"
            containPct={0.9}
          />

          <div className="absolute top-2 left-2 flex gap-1 text-xs">
            {showNew && (
              <span className="bg-black/70 px-1.5 py-0.5 rounded">🆕</span>
            )}
            {inPool && (
              <span className="bg-black/70 px-1.5 py-0.5 rounded">🎲</span>
            )}
          </div>
        </div>
      ) : (
        <div className="w-full aspect-square bg-gray-800 rounded-xl flex items-center justify-center text-gray-400 text-sm">
          No image
        </div>
      )}

      <div className="mt-2 px-2 pb-2 text-sm font-medium text-center text-white truncate">
        {game.title}
      </div>
    </button>
  );
}