// src/components/ui/Toast.jsx
import { createPortal } from "react-dom";

/**
 * Toast data shape:
 * {
 *   id: string,
 *   type?: "success" | "error" | "info",
 *   title?: string,
 *   message: string,
 * }
 */
export default function Toast({ toasts, onClose }) {
  if (!toasts || toasts.length === 0) return null;

  return createPortal(
    <div
      style={{ position: "fixed", top: 16, right: 16, zIndex: 10000 }}
      className="flex flex-col gap-2 w-[360px] max-w-[90vw]"
    >
      {toasts.map((toast) => {
        const tone =
          toast.type === "success"
            ? "border-emerald-600/70 bg-emerald-600/20 text-emerald-100"
            : toast.type === "error"
            ? "border-red-600/70 bg-red-600/20 text-red-100"
            : "border-blue-600/60 bg-blue-600/15 text-blue-100";

        return (
          <div
            key={toast.id}
            className={`rounded-2xl shadow-lg p-3 flex items-start gap-3 border ${tone}`}
            role="status"
          >
            <div className="flex-1">
              {toast.title && <div className="font-semibold">{toast.title}</div>}
              <div className="text-sm">{toast.message}</div>
            </div>

            <button
              type="button"
              className="text-xs opacity-80 hover:opacity-100"
              onClick={() => onClose(toast.id)}
              aria-label="Close toast"
              title="Close"
            >
              Dismiss
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}