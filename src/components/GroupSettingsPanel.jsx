// src/components/GroupSettingsPanel.jsx
import { useEffect, useMemo, useRef, useState } from "react";
import { DEFAULT_WEIGHTS } from "../weights/weighting";

function toNumberOrEmpty(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function shallowEqual(a, b) {
  if (a === b) return true;
  if (!a || !b) return false;
  const ak = Object.keys(a);
  const bk = Object.keys(b);
  if (ak.length !== bk.length) return false;
  for (const k of ak) {
    if (a[k] !== b[k]) return false;
  }
  return true;
}

export default function GroupSettingsPanel({ canEdit, weights, onSave, onReset }) {
  // Key off CONTENT, not object identity.
  // This prevents resetting the form if parent re-renders with the same values.
  const weightsKey = useMemo(() => JSON.stringify(weights || {}), [weights]);

  const initial = useMemo(() => {
    // Show defaults in UI but only save overrides
    return { ...DEFAULT_WEIGHTS, ...(weights || {}) };
  }, [weightsKey]);

  const [form, setForm] = useState(initial);
  const [dirty, setDirty] = useState(false);

  // Avoid repeated "apply props -> state" loops
  const lastAppliedKey = useRef(null);

  useEffect(() => {
    if (lastAppliedKey.current === weightsKey) return;
    lastAppliedKey.current = weightsKey;

    setForm((prev) => (shallowEqual(prev, initial) ? prev : initial));
    setDirty(false);
  }, [weightsKey, initial]);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function buildOverrides() {
    // Store only values that differ from DEFAULT_WEIGHTS
    const overrides = {};
    for (const [k, v] of Object.entries(form)) {
      const n = Number(v);
      if (!Number.isFinite(n)) continue;
      if (DEFAULT_WEIGHTS[k] !== n) overrides[k] = n;
    }
    return overrides;
  }

  return (
    <div className="bg-white p-4 rounded-2xl shadow border space-y-4">
      <div>
        <h3 className="text-xl font-semibold">Weight settings</h3>
        <p className="text-sm text-gray-600 mt-1">
          These weights affect the winner score as:{" "}
          <span className="font-mono">effectiveScore = sessionVotes × multiplier</span>.
          Only games with votes can win.
        </p>
      </div>

      {!canEdit && (
        <div className="text-sm text-gray-600">
          Only the group owner can edit settings.
        </div>
      )}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SettingNumber
          label="New game bonus (wNewGame)"
          help="Flat bonus if playedCount=0 and not overridden."
          value={form.wNewGame}
          step="0.05"
          min="0"
          max="5"
          onChange={(v) => setField("wNewGame", v)}
          disabled={!canEdit}
        />

        <SettingNumber
          label="Age per session (wAgeSessions)"
          help="wAgeSessions x (sessionIndex - cycleStartedSession)."
          value={form.wAgeSessions}
          step="0.05"
          min="0"
          max="5"
          onChange={(v) => setField("wAgeSessions", v)}
          disabled={!canEdit}
        />

        <SettingNumber
          label="Cycle votes strength (wCycleVotes)"
          help="wCycleVotes x cycleVoteCount."
          value={form.wCycleVotes}
          step="0.01"
          min="0"
          max="5"
          onChange={(v) => setField("wCycleVotes", v)}
          disabled={!canEdit}
        />

        <SettingNumber
          label="Recent win penalty (wRecentWinPenalty)"
          help="Penalty applied if won within recentWinSessions."
          value={form.wRecentWinPenalty}
          step="0.05"
          min="0"
          max="5"
          onChange={(v) => setField("wRecentWinPenalty", v)}
          disabled={!canEdit}
        />

        <SettingNumber
          label="Recent win window (recentWinSessions)"
          help="Number of sessions considered 'recent'."
          value={form.recentWinSessions}
          step="1"
          min="0"
          max="50"
          onChange={(v) => setField("recentWinSessions", v)}
          disabled={!canEdit}
        />

        <SettingNumber
          label="Min multiplier (minMultiplier)"
          help="Clamp lower bound."
          value={form.minMultiplier}
          step="0.05"
          min="0"
          max="10"
          onChange={(v) => setField("minMultiplier", v)}
          disabled={!canEdit}
        />

        <SettingNumber
          label="Max multiplier (maxMultiplier)"
          help="Clamp upper bound."
          value={form.maxMultiplier}
          step="0.1"
          min="0.1"
          max="50"
          onChange={(v) => setField("maxMultiplier", v)}
          disabled={!canEdit}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="px-4 py-2 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
          disabled={!canEdit}
          onClick={() => {
            setForm({ ...DEFAULT_WEIGHTS });
            setDirty(true);
          }}
        >
          Reset to defaults (local)
        </button>

        <button
          type="button"
          className="px-4 py-2 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
          disabled={!canEdit}
          onClick={onReset}
          title="Deletes overrides in Firestore"
        >
          Clear overrides (Firestore)
        </button>

        <button
          type="button"
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={!canEdit || !dirty}
          onClick={() => onSave(buildOverrides())}
        >
          Save settings
        </button>
      </div>
    </div>
  );
}

function SettingNumber({ label, help, value, onChange, step, min, max, disabled }) {
  return (
    <div className="border rounded-xl p-3 bg-gray-50">
      <div className="font-semibold text-sm">{label}</div>
      <div className="text-xs text-gray-600 mt-1">{help}</div>
      <input
        className="mt-2 w-full border rounded px-3 py-2 bg-white disabled:bg-gray-100"
        type="number"
        value={toNumberOrEmpty(value)}
        step={step}
        min={min}
        max={max}
        disabled={disabled}
        onChange={(e) => onChange(e.target.value === "" ? "" : Number(e.target.value))}
      />
    </div>
  );
}