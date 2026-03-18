import { useEffect, useMemo, useState } from "react";

const TOKEN_ICON_OPTIONS = [
  "🪙",
  "⭐",
  "💎",
  "🔥",
  "🧪",
  "🧠",
  "⚡",
  "🛡️",
  "🗡️",
  "🎯",
  "❤️",
  "☠️",
];

function createCounterId() {
  return (
    (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
    `${Date.now()}-${Math.random()}`
  );
}

function normalizeCounter(counter) {
  return {
    id: String(counter?.id || "").trim() || createCounterId(),
    name: String(counter?.name || "").trim() || "Counter",
    value: Number.isFinite(Number(counter?.value)) ? Number(counter.value) : 0,
    icon: typeof counter?.icon === "string" && counter.icon.trim() ? counter.icon.trim() : null,
  };
}

export default function TokenCountersTool({ currentGroupId }) {
  const storageKey = useMemo(
    () => `bgng:tools:tokenCounters:v1:${String(currentGroupId || "global").trim() || "global"}`,
    [currentGroupId]
  );

  const [counters, setCounters] = useState([]);
  const [didLoad, setDidLoad] = useState(false);

  const [newCounterName, setNewCounterName] = useState("");
  const [newCounterIcon, setNewCounterIcon] = useState(null);

  const [iconPickerTargetId, setIconPickerTargetId] = useState(null);

  useEffect(() => {
    try {
      const raw = window.localStorage.getItem(storageKey);
      if (!raw) {
        setCounters([]);
        setDidLoad(true);
        return;
      }

      const parsed = JSON.parse(raw);
      const next = Array.isArray(parsed) ? parsed.map(normalizeCounter) : [];
      setCounters(next);
    } catch {
      setCounters([]);
    } finally {
      setDidLoad(true);
    }
  }, [storageKey]);

  useEffect(() => {
    if (!didLoad) return;

    try {
      window.localStorage.setItem(storageKey, JSON.stringify(counters));
    } catch {
      // no-op (storage may be unavailable)
    }
  }, [counters, storageKey, didLoad]);

  function addCounter() {
    const name = String(newCounterName || "").trim() || "Counter";

    setCounters((prev) => [
      ...prev,
      {
        id: createCounterId(),
        name,
        value: 0,
        icon: newCounterIcon,
      },
    ]);

    setNewCounterName("");
    setNewCounterIcon(null);
  }

  function setCounterName(counterId, name) {
    setCounters((prev) =>
      prev.map((counter) =>
        counter.id === counterId
          ? { ...counter, name: String(name || "") }
          : counter
      )
    );
  }

  function adjustCounterValue(counterId, delta) {
    setCounters((prev) =>
      prev.map((counter) =>
        counter.id === counterId
          ? { ...counter, value: Number(counter.value || 0) + delta }
          : counter
      )
    );
  }

  function removeCounter(counterId) {
    setCounters((prev) => prev.filter((counter) => counter.id !== counterId));
  }

  function setCounterIcon(counterId, icon) {
    if (counterId === "new") {
      setNewCounterIcon(icon || null);
      return;
    }

    setCounters((prev) =>
      prev.map((counter) =>
        counter.id === counterId
          ? { ...counter, icon: icon || null }
          : counter
      )
    );
  }

  const editingNewCounterIcon = iconPickerTargetId === "new";

  return (
    <div className="space-y-4">
      <p className="text-sm text-neutral-400">
        Add quick counters for tokens, points, resources, or damage during game night.
      </p>

      <div className="ui-surface-subtle p-3 rounded-xl space-y-3">
        <div className="text-xs uppercase tracking-wide text-neutral-500">Add counter</div>
        <div className="flex items-center gap-2">
          <input
            type="text"
            className="w-full"
            placeholder="Counter name"
            value={newCounterName}
            onChange={(e) => setNewCounterName(e.target.value)}
          />
          <button
            type="button"
            className="ui-btn-secondary text-xs px-3 py-2 shrink-0"
            onClick={() => setIconPickerTargetId("new")}
            title="Pick optional icon"
          >
            {newCounterIcon || "No icon"}
          </button>
          <button
            type="button"
            className="ui-btn-primary text-xs px-3 py-2 shrink-0"
            onClick={addCounter}
          >
            Add
          </button>
        </div>
      </div>

      {counters.length === 0 ? (
        <div className="text-sm text-neutral-300">No counters yet.</div>
      ) : (
        <div className="space-y-2">
          {counters.map((counter) => {
            const value = Number(counter.value || 0);
            return (
              <div
                key={counter.id}
                className="rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-3"
              >
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    className="ui-btn-secondary text-xs px-2 py-1 shrink-0"
                    onClick={() => setIconPickerTargetId(counter.id)}
                    title="Set icon"
                  >
                    {counter.icon || "No icon"}
                  </button>

                  <input
                    type="text"
                    className="w-full text-sm"
                    value={counter.name}
                    onChange={(e) => setCounterName(counter.id, e.target.value)}
                    placeholder="Counter name"
                  />

                  <button
                    type="button"
                    className="ui-btn-danger text-xs px-2.5 py-1.5 shrink-0"
                    onClick={() => removeCounter(counter.id)}
                    title="Remove counter"
                  >
                    Remove
                  </button>
                </div>

                <div className="mt-3 flex items-center justify-between gap-3">
                  <button
                    type="button"
                    className="ui-btn-secondary text-lg leading-none px-3 py-1.5"
                    onClick={() => adjustCounterValue(counter.id, -1)}
                    aria-label={`Decrement ${counter.name || "counter"}`}
                  >
                    −
                  </button>

                  <div className="text-2xl font-bold text-white tabular-nums min-w-16 text-center">
                    {value}
                  </div>

                  <button
                    type="button"
                    className="ui-btn-secondary text-lg leading-none px-3 py-1.5"
                    onClick={() => adjustCounterValue(counter.id, 1)}
                    aria-label={`Increment ${counter.name || "counter"}`}
                  >
                    +
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {iconPickerTargetId && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="ui-modal-backdrop"
            onClick={() => setIconPickerTargetId(null)}
            aria-hidden="true"
          />

          <div className="ui-modal-shell max-w-sm">
            <div className="ui-modal-header">
              <h3 className="text-lg font-semibold text-white">Choose icon</h3>
              <button
                type="button"
                className="ui-btn-secondary px-3 py-1 text-xs"
                onClick={() => setIconPickerTargetId(null)}
              >
                Close
              </button>
            </div>

            <div className="ui-modal-body space-y-3">
              <button
                type="button"
                className="ui-btn-secondary text-sm w-full"
                onClick={() => {
                  setCounterIcon(iconPickerTargetId, null);
                  setIconPickerTargetId(null);
                }}
              >
                No icon
              </button>

              <div className="grid grid-cols-6 gap-2">
                {TOKEN_ICON_OPTIONS.map((icon) => (
                  <button
                    key={icon}
                    type="button"
                    className="h-10 rounded-lg border border-neutral-700 bg-neutral-900 hover:bg-neutral-800 text-lg"
                    onClick={() => {
                      setCounterIcon(iconPickerTargetId, icon);
                      setIconPickerTargetId(null);
                    }}
                  >
                    {icon}
                  </button>
                ))}
              </div>

              {editingNewCounterIcon && (
                <p className="text-xs text-neutral-500">
                  Icon is optional. You can add a counter without selecting one.
                </p>
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
