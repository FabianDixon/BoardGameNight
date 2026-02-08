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
    <div className="bg-white p-4 rounded-2xl shadow">
      <h2 className="text-xl font-semibold mb-3">Groups</h2>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
        <div className="border rounded-xl p-3">
          <div className="text-sm font-semibold mb-2">Create group</div>
          <div className="flex gap-2">
            <input
              className="border p-2 rounded w-full"
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

        <div className="border rounded-xl p-3">
          <div className="text-sm font-semibold mb-2">Join group</div>
          <div className="flex gap-2">
            <input
              className="border p-2 rounded w-full"
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
        <div className="text-sm font-semibold mb-2">Your groups</div>

        {groupsSorted.length === 0 ? (
          <p className="text-sm text-gray-600">No groups yet.</p>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {groupsSorted.map((g) => {
              const active = g.id === currentGroupId;
              return (
                <button
                  key={g.id}
                  className={`text-left border rounded-xl p-3 hover:bg-gray-50 ${
                    active ? "border-gray-400 bg-gray-50" : "border-gray-200 bg-white"
                  }`}
                  onClick={() => {
                    setCurrentGroupId(g.id);
                    onOpenGroup?.();
                  }}
                >
                  <div className="font-semibold">{g.name || "Untitled group"}</div>
                </button>
              );
            })}
          </div>
        )}
      </div>
    </div>
  );
}