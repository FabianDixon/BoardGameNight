// src/components/ui/Toast.jsx
export default function Toast({ toast, onClose }) {
    if (!toast) return null;
  
    const tone =
      toast.type === "success"
        ? "border-green-200 bg-green-50 text-green-900"
        : toast.type === "error"
        ? "border-red-200 bg-red-50 text-red-900"
        : "border-gray-200 bg-white text-gray-900";
  
    return (
      <div className="fixed bottom-4 left-1/2 -translate-x-1/2 z-[9999] px-4 w-full max-w-lg">
        <div className={`border rounded-2xl shadow p-3 flex items-start gap-3 ${tone}`}>
          <div className="flex-1">
            {toast.title && <div className="font-semibold">{toast.title}</div>}
            <div className="text-sm">{toast.message}</div>
          </div>
          <button
            className="text-sm underline opacity-80 hover:opacity-100"
            onClick={onClose}
            aria-label="Close toast"
          >
            Close
          </button>
        </div>
      </div>
    );
  }