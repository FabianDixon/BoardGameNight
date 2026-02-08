// src/components/GameImage.jsx
export default function GameImage({
  src,
  alt,
  className = "",
  variant = "card", // "card" | "square"
  height = "12rem", // only used for variant="card"
  containPct = 0.92, // 0..1 (how much of the frame the image fills)
}) {
  if (!src) return null;

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
        "overflow-hidden rounded-xl bg-gray-100",
        "relative flex items-center justify-center",
        className,
      ].join(" ")}
      style={frameStyle}
    >
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
    </div>
  );
}