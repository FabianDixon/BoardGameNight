// src/components/GroupsPanel.jsx
import { useMemo, useRef, useState } from "react";
import { isPermanentError } from "../utils/loadReliability";

export default function GroupsPanel({
  user,
  myGroups,
  groupsReady = true,
  groupsError = null,
  onRetryGroups,
  currentGroupId,
  setCurrentGroupId,
  onCreateGroup,
  onJoinGroup,
  onOpenGroup, // NEW: navigate to group detail view
}) {
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");
  const [creating, setCreating] = useState(false);
  const [createError, setCreateError] = useState("");
  const creatingRef = useRef(false);

  const groupsSorted = useMemo(() => {
    return [...(myGroups || [])].sort((a, b) =>
      (a.name || a.id).localeCompare(b.name || b.id)
    );
  }, [myGroups]);

  return (
    <div className="ui-surface mt-2 md:mt-3 p-4 md:p-5 space-y-4">
      <div>
        <h2 className="text-xl md:text-2xl font-semibold text-white">Groups</h2>
        <p className="text-sm text-neutral-400">Your game-night groups and shared clubs.</p>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="ui-surface-subtle p-3 md:p-4">
          <div className="text-sm font-semibold mb-2 text-white">Create group</div>
          <p className="text-xs text-neutral-400 mb-3">Start a new group for your next session.</p>
          <div className="flex gap-2">
            <input
              className="w-full"
              aria-label="Group name"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={!user || creating}
            />
            <button
              className="ui-btn-primary px-3"
              disabled={!user || !groupName.trim() || creating}
              onClick={async () => {
                if (creatingRef.current || !user || !groupName.trim()) return;
                creatingRef.current = true;
                setCreating(true);
                setCreateError("");
                try {
                  const id = await onCreateGroup(groupName.trim());
                  if (id) {
                    setGroupName("");
                    setCurrentGroupId(id);
                    onOpenGroup?.(); // go to detail
                  }
                } catch {
                  setCreateError("Could not create group. Please try again.");
                } finally {
                  creatingRef.current = false;
                  setCreating(false);
                }
              }}
              title={!user ? "Sign-in required" : ""}
            >
              {creating ? "Creating…" : "Create"}
            </button>
          </div>
          {createError && <p role="alert" className="text-sm text-red-400 mt-2">{createError}</p>}
        </div>

        <div className="ui-surface-subtle p-3 md:p-4">
          <div className="text-sm font-semibold mb-2 text-white">Join group</div>
          <p className="text-xs text-neutral-400 mb-3">Use an invite code from your group host.</p>
          <div className="flex gap-2">
            <input
              className="w-full"
              aria-label="Invite code"
              placeholder="Paste invite code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              disabled={!user}
            />
            <button
              className="ui-btn-primary px-3"
              disabled={!user || !joinCode.trim()}
              onClick={async () => {
                const id = joinCode.trim();
                const ok = await onJoinGroup(id);
                setJoinCode("");
                if (ok) {
                  setCurrentGroupId(id);
                  onOpenGroup?.(); // go to detail
                }
              }}
              title={!user ? "Sign-in required" : ""}
            >
              Join
            </button>
          </div>
        </div>
      </div>

      <div className="mt-4">
        <div className="flex items-center justify-between gap-3 mb-2">
          <div className="text-sm font-semibold text-white">Your groups</div>
          <span className="ui-chip-muted">{groupsReady ? groupsSorted.length : "…"}</span>
        </div>

        {groupsError && (
          <p role="alert" className="text-sm text-red-300 mb-2">
            Couldn't load your groups
            {groupsError?.code ? ` (${groupsError.code})` : ""}.{" "}
            {isPermanentError(groupsError) ? "Check your access, then retry." : "Retrying automatically."}{" "}
            {onRetryGroups && (
              <button type="button" className="text-blue-400 hover:underline" onClick={onRetryGroups}>
                Retry now
              </button>
            )}
          </p>
        )}

        {!groupsReady && groupsSorted.length === 0 ? (
          <div className="ui-surface-subtle p-4">
            <p className="text-sm text-gray-300">
              {groupsError ? "Groups unavailable." : "Loading groups…"}
            </p>
          </div>
        ) : groupsSorted.length === 0 ? (
          <div className="ui-surface-subtle p-4">
            <p className="text-sm text-gray-300">No groups yet. Create one or join with an invite code.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {groupsSorted.map((g) => {
              const active = g.id === currentGroupId;
              return (
                <button
                  key={g.id}
                  className={`text-left rounded-xl p-3 border transition ${
                    active ? "border-blue-500/45 bg-blue-600/15" : "border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
                  }`}
                  onClick={() => {
                    setCurrentGroupId(g.id);
                    onOpenGroup?.();
                  }}
                >
                  <div className="min-w-0">
                    <div className="font-semibold text-white truncate">{g.name || "Untitled group"}</div>
                    <div className="text-xs text-neutral-400">Group</div>
                  </div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}