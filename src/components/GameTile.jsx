// src/components/GameTile.jsx
export default function GameTile({
  game,
  selected = false,
  disabled = false,
  showNew = false,
  inPool = false,
  onClick,

  // optional: let parent control size; default works in grids
  className = "",
}) {
  const imgSrc = game.imageThumbUrl || game.imageUrl || null;

  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={[
        // IMPORTANT: no overflow-hidden here (ring/outline must be visible)
        "relative w-full rounded-xl transition",
        // Use outline instead of ring to avoid clipping/stacking issues
        selected ? "outline outline-4 outline-blue-500" : "outline outline-1 outline-gray-700",
        disabled ? "opacity-40 pointer-events-none" : "hover:outline-blue-300",
        className,
      ].join(" ")}
    >
      <div className="relative w-full bg-gray-800 aspect-square overflow-hidden flex items-center justify-center rounded-xl">
        {imgSrc ? (
          <img
            src={imgSrc}
            alt={game.title}
            loading="lazy"
            referrerPolicy="no-referrer"
            className="pointer-events-none"
            style={{
              display: "block",
              maxWidth: "100%",
              maxHeight: "100%",
              width: "auto",
              height: "auto",
              objectFit: "contain",
              objectPosition: "center",

              // hard-stop any global hover zoom rules
              transform: "none",
              transition: "none",
            }}
          />
        ) : (
          <div className="h-full flex items-center justify-center text-gray-400 text-sm">
            No image
          </div>
        )}

        <div className="absolute top-2 left-2 flex gap-1 text-xs">
          {showNew && <span className="bg-black/70 px-1.5 py-0.5 rounded">🆕</span>}
          {inPool && <span className="bg-black/70 px-1.5 py-0.5 rounded">🎲</span>}
        </div>
      </div>

      <div className="mt-2 px-2 pb-2 text-sm font-medium text-center text-white truncate">
        {game.title}
      </div>
    </button>
  );
}