// src/components/GroupDetail.jsx
import GameTile from "./GameTile";

export default function GroupDetail({
  group,
  groupTab,
  setGroupTab,
  onBack,
  onLeaveGroup,
  groupGames,
  onOpenGame,
  onToast,
  votingNode, 
  settingsNode,
  canEditNewness,
  onTogglePlayedOverride,
}) {
  const groupId = group?.id;

  return (
    <div className="space-y-4">
      <div className="bg-white p-4 rounded-2xl shadow border">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <button
              className="text-sm text-blue-700 hover:underline"
              onClick={onBack}
              type="button"
            >
              ← Back to groups
            </button>

            <h2 className="text-2xl font-bold mt-2 truncate">
              {group?.name || "Group"}
            </h2>

            {groupId && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-500">Invite code:</span>
                <code className="px-2 py-1 text-xs bg-gray-100 border rounded font-mono">
                  {groupId}
                </code>
                <button
                  className="text-sm text-blue-700 hover:underline"
                  type="button"
                  onClick={async () => {
                    await navigator.clipboard.writeText(groupId);
                    onToast?.("Invite code copied!", "success");
                  }}
                >
                  Copy
                </button>
              </div>
            )}
          </div>

          {groupId && onLeaveGroup && (
            <button
              className="text-sm text-red-700 hover:underline shrink-0"
              type="button"
              onClick={() => onLeaveGroup(groupId)}
            >
              Leave group
            </button>
          )}
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          <button
            className={`px-3 py-2 rounded-full border ${
              groupTab === "collection" ? "bg-gray-100" : "bg-white"
            }`}
            onClick={() => setGroupTab("collection")}
            type="button"
          >
            Collection
          </button>
          <button
            className={`px-3 py-2 rounded-full border ${
              groupTab === "voting" ? "bg-gray-100" : "bg-white"
            }`}
            onClick={() => setGroupTab("voting")}
            type="button"
          >
            Voting
          </button>
          {settingsNode && (
            <button
              className={`px-3 py-2 rounded-full border ${
                groupTab === "settings" ? "bg-gray-100" : "bg-white"
              }`}
              onClick={() => setGroupTab("settings")}
              type="button"
            >
              Settings
            </button>
          )}
        </div>
      </div>

      {groupTab === "collection" && (
        <div className="bg-white p-4 rounded-2xl shadow border">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold">Group collection</h3>
            <span className="text-sm text-gray-600">
              {groupGames.length} games
            </span>
          </div>

          {groupGames.length === 0 ? (
            <p className="text-sm text-gray-600">
              No games in this group yet. Add games to your collection to
              populate it.
            </p>
          ) : (
            <div className="mx-auto max-w-6xl">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 items-start">
                {groupGames.map((game) => {
                  const isNewForGroup =
                    Number(game.playedCount || 0) === 0 && !game.playedOverride;

                  const selected = false; // group collection doesn’t need selection yet

                  return (
                    <div key={game.id} className="relative">
                      <GameTile
                        game={game}
                        selected={selected}
                        disabled={false}
                        showNew={isNewForGroup}
                        inPool={!!game.isActiveInPool}
                        onClick={() => onOpenGame(game)}
                        className="max-w-[220px] mx-auto"
                      />

                      {canEditNewness && onTogglePlayedOverride && (
                        <button
                          type="button"
                          className="absolute top-2 right-2 bg-black/70 text-white text-xs px-2 py-1 rounded hover:bg-black/80"
                          onClick={(e) => {
                            e.stopPropagation();
                            onTogglePlayedOverride(game.id, !game.playedOverride);
                          }}
                          title="Only the group owner can change this"
                        >
                          {game.playedOverride ? "↩︎ New" : "✓ Played"}
                        </button>
                      )}
                    </div>
                  );
                })}
              </div>
            </div>
          )}
        </div>
      )}

      {groupTab === "voting" && votingNode}
      {groupTab === "settings" && settingsNode}
    </div>
  );
}