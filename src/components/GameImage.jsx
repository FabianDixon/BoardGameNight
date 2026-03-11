// src/components/GameImage.jsx
export default function GameImage({
  src,
  alt,
  className = "",
  variant = "card", // "card" | "square"
  height = "13rem", // only used for variant="card"
  containPct = 0.92, // 0..1 (how much of the frame the image fills)
}) {
  const maxPct = `${Math.round(containPct * 100)}%`;

  const frameClass =
    variant === "square"
      ? "w-full aspect-square"
      : "w-full";

  const frameStyle =
    variant === "square"
      ? undefined
      : { height };

  return (
    <div
      className={[
        frameClass,
        "overflow-hidden relative flex items-center justify-center",
        "bg-neutral-900 border-b border-neutral-700",
        "relative flex items-center justify-center",
        className,
      ].join(" ")}
      style={frameStyle}
    >
      {src ? (
        <img
          src={src}
          alt={alt}
          loading="lazy"
          referrerPolicy="no-referrer"
          className="block object-contain pointer-events-none"
          style={{
            position: "static",
            width: "auto",
            height: "auto",
            maxWidth: maxPct,
            maxHeight: maxPct,
            transform: "none",
            transition: "none",
          }}
          onError={(e) => {
            e.currentTarget.style.display = "none";
          }}
        />
      ) : (
        <span className="text-xs uppercase tracking-wide text-neutral-500">No cover</span>
      )}

      <div className="pointer-events-none absolute inset-x-0 bottom-0 h-10 bg-gradient-to-t from-black/35 to-transparent" />
    </div>
  );
}