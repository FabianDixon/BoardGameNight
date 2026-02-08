// src/components/ui/Fab.jsx
import { createPortal } from "react-dom";

/**
 * Floating Action Button.
 * - Uses a portal to escape layout containers.
 * - Supports icon-only (+) or labeled "pill" buttons.
 */
export default function Fab({
  show,
  onClick,
  label = "Action",
  children = "+",
  disabled = false,
  variant = "circle", // "circle" | "pill"
  right = 16,
  bottom = 16,
  className = "",
  style = {},
}) {
  if (!show) return null;

  const isPill = variant === "pill";

  return createPortal(
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={disabled ? undefined : onClick}
      disabled={disabled}
      style={{
        position: "fixed",
        right,
        bottom,
        zIndex: 9999,
        ...(isPill
          ? { padding: "12px 16px", borderRadius: "9999px" }
          : { width: 56, height: 56, borderRadius: "9999px" }),
        ...style,
      }}
      className={[
        "shadow-lg flex items-center justify-center transition select-none",
        disabled
          ? "bg-gray-200 text-gray-400 cursor-not-allowed"
          : "bg-blue-600 text-white hover:bg-blue-500 active:scale-95",
        isPill ? "text-sm font-semibold border" : "text-3xl",
        className,
      ].join(" ")}
    >
      {children}
    </button>,
    document.body
  );
}