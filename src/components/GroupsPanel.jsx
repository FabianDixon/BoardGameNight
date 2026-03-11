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
    <div className="ui-surface p-4">
      <h2 className="text-xl font-semibold mb-3 text-white">Groups</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="ui-surface-subtle p-3">
          <div className="text-sm font-semibold mb-2 text-white">Create group</div>
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

        <div className="ui-surface-subtle p-3">
          <div className="text-sm font-semibold mb-2 text-white">Join group</div>
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
        <div className="text-sm font-semibold mb-2 text-white">Your groups</div>

        {groupsSorted.length === 0 ? (
          <p className="text-sm text-gray-300">No groups yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {groupsSorted.map((g) => {
              const active = g.id === currentGroupId;
              return (
                <button
                  key={g.id}
                  className={`text-left rounded-xl p-3 border transition ${
                    active ? "border-blue-500/40 bg-blue-600/15" : "border-neutral-700 bg-neutral-900 hover:bg-neutral-800"
                  }`}
                  onClick={() => {
                    setCurrentGroupId(g.id);
                    onOpenGroup?.();
                  }}
                >
                  <div className="font-semibold text-white">{g.name || "Untitled group"}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}