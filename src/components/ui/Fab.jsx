// src/components/ui/Fab.jsx
import { createPortal } from "react-dom";

export default function Fab({ show, onClick, label = "Add" }) {
  if (!show) return null;

  return createPortal(
    <button
      type="button"
      aria-label={label}
      title={label}
      onClick={onClick}
      style={{
        position: "fixed",
        right: "16px",
        bottom: "16px",
        width: "56px",
        height: "56px",
        borderRadius: "9999px",
        zIndex: 9999,
      }}
      className="bg-blue-600 text-white shadow-lg flex items-center justify-center text-3xl hover:bg-blue-500 active:scale-95 transition"
    >
      +
    </button>,
    document.body
  );
}