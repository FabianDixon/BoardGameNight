// src/components/GroupsPanel.jsx
import { useMemo, useState } from "react";

export default function GroupsPanel({
  user,
  myGroups,
  currentGroupId,
  setCurrentGroupId,
  onCreateGroup,
  onJoinGroup,
  onOpenGroup, // NEW: navigate to group detail view
}) {
  const [groupName, setGroupName] = useState("");
  const [joinCode, setJoinCode] = useState("");

  const groupsSorted = useMemo(() => {
    return [...(myGroups || [])].sort((a, b) =>
      (a.name || a.id).localeCompare(b.name || b.id)
    );
  }, [myGroups]);

  return (
    <div className="ui-surface p-4 md:p-5 space-y-4">
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
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={!user}
            />
            <button
              className="ui-btn-primary px-3"
              disabled={!user || !groupName.trim()}
              onClick={async () => {
                const id = await onCreateGroup(groupName.trim());
                setGroupName("");
                if (id) {
                  setCurrentGroupId(id);
                  onOpenGroup?.(); // go to detail
                }
              }}
              title={!user ? "Sign-in required" : ""}
            >
              Create
            </button>
          </div>
        </div>

        <div className="ui-surface-subtle p-3 md:p-4">
          <div className="text-sm font-semibold mb-2 text-white">Join group</div>
          <p className="text-xs text-neutral-400 mb-3">Use an invite code from your group host.</p>
          <div className="flex gap-2">
            <input
              className="w-full"
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
          <span className="ui-chip-muted">{groupsSorted.length}</span>
        </div>

        {groupsSorted.length === 0 ? (
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