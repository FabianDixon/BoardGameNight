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
            ? "border-green-700 bg-green-900 text-green-200"
            : toast.type === "error"
            ? "border-red-700 bg-red-900 text-red-200"
            : "border-neutral-700 bg-neutral-800 text-gray-200";

        return (
          <div
            key={toast.id}
            className={`border rounded-2xl shadow p-3 flex items-start gap-3 ${tone}`}
            role="status"
          >
            <div className="flex-1">
              {toast.title && <div className="font-semibold">{toast.title}</div>}
              <div className="text-sm">{toast.message}</div>
            </div>

            <button
              type="button"
              className="text-sm underline opacity-80 hover:opacity-100"
              onClick={() => onClose(toast.id)}
              aria-label="Close toast"
              title="Close"
            >
              Close
            </button>
          </div>
        );
      })}
    </div>,
    document.body
  );
}