// src/components/GroupSettingsPanel.jsx
import { useMemo, useState } from "react";
import { DEFAULT_WEIGHTS } from "../weights/weighting";

function toNumberOrEmpty(v) {
  if (v === "" || v === null || v === undefined) return "";
  const n = Number(v);
  return Number.isFinite(n) ? n : "";
}

function safeRoleLabel(role) {
  if (role === "owner") return "Owner";
  if (role === "moderator") return "Moderator";
  return "Member";
}

export default function GroupSettingsPanel({
  group,
  user,
  members,
  myRole,

  // Settings docs
  meta,
  weights,

  // Permissions
  canEditMeta,
  canEditWeights,

  // Optional: if parent knows existence explicitly (recommended)
  metaExists: metaExistsProp,
  onInitMeta,

  // Actions
  onSaveWeights,
  onResetWeights,
  onSaveMeta,
  onSetMemberRole,
  onTransferOwnership,
}) {
  const isOwner = !!user && group?.ownerId === user.uid;

  // Prefer explicit existence flag from parent if provided
  const metaExists = metaExistsProp ?? !!meta;

  const metaInitial = useMemo(
    () => ({
      disallowVotingOwnSubmission: meta?.disallowVotingOwnSubmission ?? false,
      moderatorsCanEditWeights: meta?.moderatorsCanEditWeights ?? false,

      autoAdvanceWhenAllSubmitted: meta?.autoAdvanceWhenAllSubmitted ?? false,
      autoAdvanceWhenAllVoted: meta?.autoAdvanceWhenAllVoted ?? false,

      // Optional/future (safe to keep; not used for auto-advance-by-participation)
      collectingDurationMinutes: meta?.collectingDurationMinutes ?? 10,
      votingDurationMinutes: meta?.votingDurationMinutes ?? 10,
    }),
    [meta]
  );

  const metaKey = useMemo(() => JSON.stringify(metaInitial), [metaInitial]);

  const initialWeights = useMemo(
    () => ({ ...DEFAULT_WEIGHTS, ...(weights || {}) }),
    [weights]
  );

  const weightsKey = useMemo(
    () => JSON.stringify(initialWeights),
    [initialWeights]
  );

  const ownerOnlyMsg = useMemo(() => {
    if (!user) return "Sign in to manage group settings.";
    if (!group?.id) return "No group selected.";
    if (!isOwner) return "Only the group owner can manage roles and group rules.";
    return "";
  }, [user, group, isOwner]);

  const weightsEditMsg = useMemo(() => {
    if (!user) return "Sign in to edit weight settings.";
    if (!canEditWeights) return "Only the owner (or a moderator) can edit weight settings.";
    return "";
  }, [user, canEditWeights]);

  return (
    <div className="space-y-4">
      <MetaSettingsSection
        key={metaKey}
        canEditMeta={canEditMeta}
        ownerOnlyMsg={ownerOnlyMsg}
        initial={metaInitial}
        metaExists={metaExists}
        onInitMeta={onInitMeta}
        onSaveMeta={onSaveMeta}
      />

      <MembersSection
        group={group}
        user={user}
        members={members}
        isOwner={isOwner}
        ownerOnlyMsg={ownerOnlyMsg}
        onSetMemberRole={onSetMemberRole}
        onTransferOwnership={onTransferOwnership}
      />

      <WeightsSection
        key={weightsKey}
        canEditWeights={canEditWeights}
        weightsEditMsg={weightsEditMsg}
        initial={initialWeights}
        onSaveWeights={onSaveWeights}
        onResetWeights={onResetWeights}
      />

      <div className="text-xs text-gray-500">
        Your role:{" "}
        <span className="font-mono">{safeRoleLabel(myRole || "member")}</span>
      </div>
    </div>
  );
}

function MetaSettingsSection({
  canEditMeta,
  ownerOnlyMsg,
  initial,
  metaExists,
  onInitMeta,
  onSaveMeta,
}) {
  const [metaForm, setMetaForm] = useState(() => initial);
  const [metaDirty, setMetaDirty] = useState(false);

  function setMetaField(key, value) {
    setMetaForm((prev) => ({ ...prev, [key]: value }));
    setMetaDirty(true);
  }

  return (
    <div className="bg-white p-4 rounded-2xl shadow border space-y-3">
      <div>
        <h3 className="text-xl font-semibold">Group rules</h3>
        <p className="text-sm text-gray-600 mt-1">
          Owner-controlled rules that affect session behavior.
        </p>
      </div>

      {!canEditMeta && <div className="text-sm text-gray-600">{ownerOnlyMsg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SettingToggle
          label="Disallow voting for your own submission"
          help="If enabled, you cannot vote for the game you submitted in the collecting phase (current session only)."
          checked={!!metaForm.disallowVotingOwnSubmission}
          disabled={!canEditMeta}
          onChange={(v) => setMetaField("disallowVotingOwnSubmission", v)}
        />

        <SettingToggle
          label="Moderators can edit weights"
          help="If enabled, members with the Moderator role can edit weight settings."
          checked={!!metaForm.moderatorsCanEditWeights}
          disabled={!canEditMeta}
          onChange={(v) => setMetaField("moderatorsCanEditWeights", v)}
        />

        <SettingToggle
          label="Auto-advance when everyone submitted"
          help="If enabled, the session automatically moves from Collecting → Voting when all members submitted."
          checked={!!metaForm.autoAdvanceWhenAllSubmitted}
          disabled={!canEditMeta}
          onChange={(v) => setMetaField("autoAdvanceWhenAllSubmitted", v)}
        />

        <SettingToggle
          label="Auto-advance when everyone voted"
          help="If enabled, the session automatically moves from Voting → Results when all members voted."
          checked={!!metaForm.autoAdvanceWhenAllVoted}
          disabled={!canEditMeta}
          onChange={(v) => setMetaField("autoAdvanceWhenAllVoted", v)}
        />

        <SettingNumber
          label="Collecting duration (minutes)"
          help="Optional (for future timed mode). Not used for auto-advance-by-participation."
          value={metaForm.collectingDurationMinutes}
          step="1"
          min="1"
          max="180"
          onChange={(v) =>
            setMetaField("collectingDurationMinutes", v === "" ? "" : Number(v))
          }
          disabled={!canEditMeta}
        />

        <SettingNumber
          label="Voting duration (minutes)"
          help="Optional (for future timed mode). Not used for auto-advance-by-participation."
          value={metaForm.votingDurationMinutes}
          step="1"
          min="1"
          max="180"
          onChange={(v) =>
            setMetaField("votingDurationMinutes", v === "" ? "" : Number(v))
          }
          disabled={!canEditMeta}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        {!metaExists && canEditMeta && typeof onInitMeta === "function" && (
          <button
            type="button"
            className="px-4 py-2 rounded border bg-yellow-50 hover:bg-yellow-100 text-sm"
            onClick={onInitMeta}
          >
            Initialize group rules (create defaults)
          </button>
        )}

        <button
          type="button"
          className="px-4 py-2 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
          disabled={!canEditMeta || !metaDirty || typeof onSaveMeta !== "function"}
          onClick={() => {
            onSaveMeta?.({
              disallowVotingOwnSubmission: !!metaForm.disallowVotingOwnSubmission,
              moderatorsCanEditWeights: !!metaForm.moderatorsCanEditWeights,
              autoAdvanceWhenAllSubmitted: !!metaForm.autoAdvanceWhenAllSubmitted,
              autoAdvanceWhenAllVoted: !!metaForm.autoAdvanceWhenAllVoted,
              collectingDurationMinutes: Number(metaForm.collectingDurationMinutes) || 10,
              votingDurationMinutes: Number(metaForm.votingDurationMinutes) || 10,
              updatedAt: Date.now(),
            });
            setMetaDirty(false);
          }}
          title={
            typeof onSaveMeta !== "function"
              ? "Wire onSaveMeta from App.jsx to enable saving."
              : ""
          }
        >
          Save group rules
        </button>
      </div>
    </div>
  );
}

function MembersSection({
  group,
  user,
  members,
  isOwner,
  ownerOnlyMsg,
  onSetMemberRole,
  onTransferOwnership,
}) {
  return (
    <div className="bg-white p-4 rounded-2xl shadow border space-y-3">
      <div>
        <h3 className="text-xl font-semibold">Members</h3>
        <p className="text-sm text-gray-600 mt-1">
          Roles: <span className="font-medium">Owner</span>,{" "}
          <span className="font-medium">Member</span>,{" "}
          <span className="font-medium">Moderator</span> (weights only).
        </p>
      </div>

      {!isOwner && <div className="text-sm text-gray-600">{ownerOnlyMsg}</div>}

      <div className="space-y-2">
        {members?.length ? (
          members.map((m) => {
            const isMe = m.userId === user?.uid;
            const role = m.role || (m.userId === group?.ownerId ? "owner" : "member");
            const display = m.nickname || (isMe ? "You" : m.userId);

            return (
              <div
                key={m.userId}
                className="flex flex-wrap items-center justify-between gap-2 border rounded-xl p-3 bg-gray-50"
              >
                <div className="min-w-0">
                  <div className="font-semibold text-sm truncate">{display}</div>
                  <div className="text-xs text-gray-600">
                    {safeRoleLabel(role)} {isMe ? "• (you)" : ""}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <select
                    className="border rounded px-2 py-1 text-sm bg-white disabled:bg-gray-100"
                    disabled={!isOwner || role === "owner"}
                    value={role === "owner" ? "owner" : role}
                    onChange={(e) => {
                      onSetMemberRole?.(group.id, m.userId, e.target.value);
                    }}
                    title={!isOwner ? "Only owner can change roles" : ""}
                  >
                    <option value="owner" disabled>
                      Owner
                    </option>
                    <option value="member">Member</option>
                    <option value="moderator">Moderator</option>
                  </select>

                  <button
                    type="button"
                    className="px-3 py-2 rounded border bg-white hover:bg-gray-50 disabled:opacity-50 text-sm"
                    disabled={!isOwner || m.userId === group?.ownerId}
                    onClick={() => onTransferOwnership?.(group.id, m.userId)}
                    title={!isOwner ? "Only owner can transfer ownership" : ""}
                  >
                    Transfer ownership
                  </button>
                </div>
              </div>
            );
          })
        ) : (
          <div className="text-sm text-gray-600">Loading members…</div>
        )}
      </div>
    </div>
  );
}

function WeightsSection({
  canEditWeights,
  weightsEditMsg,
  initial,
  onSaveWeights,
  onResetWeights,
}) {
  const [form, setForm] = useState(() => initial);
  const [dirty, setDirty] = useState(false);

  function setField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
    setDirty(true);
  }

  function buildOverrides() {
    const overrides = {};
    for (const [k, v] of Object.entries(form)) {
      if (v === "") continue;
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
          These weights affect the winner score as{" "}
          <span className="font-mono">effectiveScore = sessionVotes × multiplier</span>. Only games with votes can win.
        </p>
      </div>

      {!canEditWeights && <div className="text-sm text-gray-600">{weightsEditMsg}</div>}

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <SettingNumber
          label="New game bonus (wNewGame)"
          help="Flat bonus if playedCount=0 and not overridden."
          value={form.wNewGame}
          step="0.05"
          min="0"
          max="5"
          onChange={(v) => setField("wNewGame", v)}
          disabled={!canEditWeights}
        />
        <SettingNumber
          label="Age per session (wAgeSessions)"
          help="wAgeSessions × (sessionIndex - cycleStartedSession)."
          value={form.wAgeSessions}
          step="0.05"
          min="0"
          max="5"
          onChange={(v) => setField("wAgeSessions", v)}
          disabled={!canEditWeights}
        />
        <SettingNumber
          label="Cycle votes strength (wCycleVotes)"
          help="wCycleVotes × cycleVoteCount."
          value={form.wCycleVotes}
          step="0.01"
          min="0"
          max="5"
          onChange={(v) => setField("wCycleVotes", v)}
          disabled={!canEditWeights}
        />
        <SettingNumber
          label="Recent win penalty (wRecentWinPenalty)"
          help="Penalty applied if won within recentWinSessions."
          value={form.wRecentWinPenalty}
          step="0.05"
          min="0"
          max="5"
          onChange={(v) => setField("wRecentWinPenalty", v)}
          disabled={!canEditWeights}
        />
        <SettingNumber
          label="Recent win window (recentWinSessions)"
          help="Number of sessions considered 'recent'."
          value={form.recentWinSessions}
          step="1"
          min="0"
          max="50"
          onChange={(v) => setField("recentWinSessions", v)}
          disabled={!canEditWeights}
        />
        <SettingNumber
          label="Min multiplier (minMultiplier)"
          help="Clamp lower bound."
          value={form.minMultiplier}
          step="0.05"
          min="0"
          max="10"
          onChange={(v) => setField("minMultiplier", v)}
          disabled={!canEditWeights}
        />
        <SettingNumber
          label="Max multiplier (maxMultiplier)"
          help="Clamp upper bound."
          value={form.maxMultiplier}
          step="0.1"
          min="0.1"
          max="50"
          onChange={(v) => setField("maxMultiplier", v)}
          disabled={!canEditWeights}
        />
      </div>

      <div className="flex flex-wrap gap-2">
        <button
          type="button"
          className="px-4 py-2 rounded border bg-white hover:bg-gray-50 disabled:opacity-50"
          disabled={!canEditWeights}
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
          disabled={!canEditWeights}
          onClick={() => onResetWeights?.()}
          title="Deletes overrides in Firestore"
        >
          Clear overrides (Firestore)
        </button>

        <button
          type="button"
          className="px-4 py-2 rounded bg-blue-600 text-white hover:bg-blue-700 disabled:opacity-50"
          disabled={!canEditWeights || !dirty}
          onClick={() => onSaveWeights?.(buildOverrides())}
        >
          Save weights
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

function SettingToggle({ label, help, checked, disabled, onChange }) {
  return (
    <div className="border rounded-xl p-3 bg-gray-50">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-sm">{label}</div>
          <div className="text-xs text-gray-600 mt-1">{help}</div>
        </div>

        <div className="flex items-center gap-2">
          {/* Optional but very clear: text cue */}
          <span className="text-xs text-gray-600 w-8 text-right">
            {checked ? "On" : "Off"}
          </span>

          <button
            type="button"
            className={[
              "w-12 h-7 rounded-full transition border flex items-center",
              checked
                ? "bg-blue-600 border-blue-600 justify-end"
                : "bg-gray-200 border-gray-300 justify-start",
              disabled ? "opacity-50 cursor-not-allowed" : "cursor-pointer",
            ].join(" ")}
            disabled={disabled}
            onClick={() => onChange(!checked)}
            aria-pressed={checked}
            aria-label={label}
          >
            <span
              className={[
                "w-5 h-5 rounded-full shadow mx-1 transition",
                checked ? "bg-white" : "bg-white",
              ].join(" ")}
            />
          </button>
        </div>
      </div>
    </div>
  );
}