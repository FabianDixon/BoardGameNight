// src/components/GroupDetail.jsx
import { useMemo, useState } from "react";
import GameTile from "./GameTile";
import { GROUP_TAB, POOL_FILTER } from "../constants/workflow";

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
  myCollectionGames,
  mySharedGameIds,
  onSetMyGameSharedInGroup,
}) {
  const groupId = group?.id;

  // Filter group collection by pool membership (🎲)
  // all | in | out
  const [poolFilter, setPoolFilter] = useState(POOL_FILTER.ALL);
  const [manageBusyId, setManageBusyId] = useState(null);
  const [manageQuery, setManageQuery] = useState("");

  const poolCounts = useMemo(() => {
    const inPool = (groupGames || []).filter((g) => !!g.isActiveInPool).length;
    const total = (groupGames || []).length;
    return { inPool, outPool: Math.max(0, total - inPool), total };
  }, [groupGames]);

  const filteredGames = useMemo(() => {
    const arr = groupGames || [];
    if (poolFilter === POOL_FILTER.IN_POOL) return arr.filter((g) => !!g.isActiveInPool);
    if (poolFilter === POOL_FILTER.OUT_OF_POOL) return arr.filter((g) => !g.isActiveInPool);
    return arr;
  }, [groupGames, poolFilter]);

  return (
    <div className="space-y-4">
      <div className="ui-surface p-4">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <button
              className="text-sm text-blue-400 hover:underline"
              onClick={onBack}
              type="button"
            >
              ← Back to groups
            </button>

            <h2 className="text-2xl font-bold mt-2 truncate text-white">
              {group?.name || "Group"}
            </h2>

            {groupId && (
              <div className="mt-2 flex flex-wrap items-center gap-2">
                <span className="text-xs text-gray-400">Invite code:</span>
                <code className="px-2 py-1 text-xs bg-neutral-900 border border-neutral-700 rounded font-mono text-gray-300">
                  {groupId}
                </code>
                <button
                  className="text-sm text-blue-400 hover:underline"
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
              className="text-sm text-red-400 hover:underline shrink-0"
              type="button"
              onClick={() => onLeaveGroup(groupId)}
            >
              Leave group
            </button>
          )}
        </div>

        <div className="mt-4 flex gap-2 flex-wrap">
          <button
            className={`ui-segment ${
              groupTab === GROUP_TAB.COLLECTION ? "ui-pill-active" : "ui-pill-inactive"
            }`}
            onClick={() => setGroupTab(GROUP_TAB.COLLECTION)}
            type="button"
          >
            Collection
          </button>
          <button
            className={`ui-segment ${
              groupTab === GROUP_TAB.VOTING ? "ui-pill-active" : "ui-pill-inactive"
            }`}
            onClick={() => setGroupTab(GROUP_TAB.VOTING)}
            type="button"
          >
            Voting
          </button>
          {settingsNode && (
            <button
              className={`ui-segment ${
                groupTab === GROUP_TAB.SETTINGS ? "ui-pill-active" : "ui-pill-inactive"
              }`}
              onClick={() => setGroupTab(GROUP_TAB.SETTINGS)}
              type="button"
            >
              Settings
            </button>
          )}
        </div>
      </div>

      {groupTab === GROUP_TAB.COLLECTION && (
        <div className="ui-surface p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-xl font-semibold text-white">Group collection</h3>

            <div className="flex items-center gap-2">
              {groupId && myCollectionGames && onSetMyGameSharedInGroup && (
                <button
                  type="button"
                  className="ui-pill ui-pill-active"
                  onClick={() => setGroupTab(GROUP_TAB.MANAGE)}
                  title="Choose which games from your library are shared with this group"
                >
                  Manage my games
                </button>
              )}

              <span className="text-sm text-gray-300">
                {filteredGames.length} / {poolCounts.total} games
              </span>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-2 mb-3">
            <button
              type="button"
              className={`ui-pill ${
                poolFilter === POOL_FILTER.ALL ? "ui-pill-active" : "ui-pill-inactive"
              }`}
              onClick={() => setPoolFilter(POOL_FILTER.ALL)}
              title="Show all games"
            >
              All ({poolCounts.total})
            </button>

            <button
              type="button"
              className={`ui-pill ${
                poolFilter === POOL_FILTER.IN_POOL ? "ui-pill-active" : "ui-pill-inactive"
              }`}
              onClick={() => setPoolFilter(POOL_FILTER.IN_POOL)}
              title="Show games that are already in the pool"
            >
              🎲 In pool ({poolCounts.inPool})
            </button>

            <button
              type="button"
              className={`ui-pill ${
                poolFilter === POOL_FILTER.OUT_OF_POOL ? "ui-pill-active" : "ui-pill-inactive"
              }`}
              onClick={() => setPoolFilter(POOL_FILTER.OUT_OF_POOL)}
              title="Show games that are not in the pool"
            >
              Not in pool ({poolCounts.outPool})
            </button>
          </div>

          {poolCounts.total === 0 ? (
            <p className="text-sm text-gray-300">
              No games in this group yet. Add games to your collection to
              populate it.
            </p>
          ) : (
            filteredGames.length === 0 ? (
              <p className="text-sm text-gray-300">No games match this filter.</p>
            ) : (
            <div className="mx-auto max-w-6xl">
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 gap-4 items-start">
                {filteredGames.map((game) => {
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
            )
          )}
        </div>
      )}

      {groupTab === GROUP_TAB.MANAGE && (
        <div className="ui-surface p-4">
          <div className="flex items-center justify-between gap-3 mb-3">
            <div>
              <h3 className="text-xl font-semibold text-white">Manage my games</h3>
              <p className="text-sm text-gray-300">
                Choose which games from your library are shared with <span className="font-medium">{group?.name || "this group"}</span>.
              </p>
            </div>

            <button
              type="button"
              className="ui-pill ui-pill-active"
              onClick={() => setGroupTab(GROUP_TAB.COLLECTION)}
              disabled={!!manageBusyId}
            >
              Back to collection
            </button>
          </div>

          <div className="flex items-center gap-2 mb-3">
            <input
              className="w-full"
              placeholder="Search my library…"
              value={manageQuery}
              onChange={(e) => setManageQuery(e.target.value)}
            />
          </div>

          {(myCollectionGames || []).length === 0 ? (
            <p className="text-sm text-gray-300">Your collection is empty.</p>
          ) : (
            <div className="max-h-[70vh] overflow-auto divide-y">
              {[...(myCollectionGames || [])]
                .slice()
                .sort((a, b) => (a.title || "").localeCompare(b.title || ""))
                .filter((g) => (g.title || "").toLowerCase().includes((manageQuery || "").trim().toLowerCase()))
                .map((g) => {
                  const shared = !!mySharedGameIds?.has(g.id);
                  const busy = manageBusyId === g.id;

                  return (
                    <div key={g.id} className="py-3 flex items-center justify-between gap-3">
                      <div className="min-w-0">
                        <div className="font-medium truncate text-white">{g.title}</div>
                        <div className="text-xs text-gray-400">{shared ? "Shared with group" : "Hidden from group"}</div>
                      </div>

                      <button
                        type="button"
                        className={`ui-pill whitespace-nowrap ${
                          shared ? "ui-pill-active" : "ui-pill-inactive"
                        }`}
                        disabled={busy}
                        onClick={async () => {
                          try {
                            setManageBusyId(g.id);
                            await onSetMyGameSharedInGroup(groupId, g.id, !shared);
                          } finally {
                            setManageBusyId(null);
                          }
                        }}
                        title={shared ? "Hide this game from the group" : "Share this game with the group"}
                      >
                        {busy ? "Working…" : shared ? "Hide" : "Share"}
                      </button>
                    </div>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {groupTab === GROUP_TAB.VOTING && votingNode}
      {groupTab === GROUP_TAB.SETTINGS && settingsNode}
    </div>
  );
}