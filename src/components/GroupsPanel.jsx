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
    <div className="bg-neutral-800 p-4 rounded-2xl shadow border border-neutral-700">
      <h2 className="text-xl font-semibold mb-3 text-white">Groups</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border border-neutral-700 rounded-xl p-3 bg-neutral-900">
          <div className="text-sm font-semibold mb-2 text-white">Create group</div>
          <div className="flex gap-2">
            <input
              className="border border-neutral-700 p-2 rounded w-full bg-neutral-900 text-white placeholder-gray-400"
              placeholder="Group name"
              value={groupName}
              onChange={(e) => setGroupName(e.target.value)}
              disabled={!user}
            />
            <button
              className="bg-blue-600 text-white px-3 py-2 rounded"
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

        <div className="border border-neutral-700 rounded-xl p-3 bg-neutral-900">
          <div className="text-sm font-semibold mb-2 text-white">Join group</div>
          <div className="flex gap-2">
            <input
              className="border border-neutral-700 p-2 rounded w-full bg-neutral-900 text-white placeholder-gray-400"
              placeholder="Paste invite code"
              value={joinCode}
              onChange={(e) => setJoinCode(e.target.value)}
              disabled={!user}
            />
            <button
              className="bg-blue-600 text-white px-3 py-2 rounded"
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
                  className={`text-left border rounded-xl p-3 ${
                    active ? "border-neutral-600 bg-neutral-700 hover:bg-neutral-600" : "border-neutral-700 bg-neutral-800 hover:bg-neutral-700"
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