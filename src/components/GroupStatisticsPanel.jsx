import { useMemo } from "react";

function truncateUserId(userId) {
  const value = String(userId || "").trim();
  if (!value) return "Unknown member";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function formatDateLabel(timestamp) {
  if (!Number.isFinite(timestamp)) return "—";
  return new Date(timestamp).toLocaleDateString(undefined, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
}

function formatPercent(value) {
  if (!Number.isFinite(value)) return "0%";
  return `${Math.round(value * 100)}%`;
}

export default function GroupStatisticsPanel({
  sessionHistory = [],
  games = [],
  participantSummaryById = {},
}) {
  const gameTitleById = useMemo(() => {
    const map = new Map();
    for (const game of games || []) {
      const gameId = String(game?.id || "").trim();
      if (!gameId) continue;
      map.set(gameId, game?.title || gameId);
    }
    return map;
  }, [games]);

  const stats = useMemo(() => {
    const rows = Array.isArray(sessionHistory) ? sessionHistory : [];
    const totalSessions = rows.length;

    const playedGameCounts = new Map();
    const uniqueGames = new Set();

    const appearances = new Map();
    const firstPlaceCounts = new Map();
    const podiumCounts = new Map();
    const medalCounts = new Map();

    let mostRecentSessionAt = null;
    let coopSessions = 0;
    let coopWins = 0;
    let coopLosses = 0;

    for (const play of rows) {
      const playedAt = Number(play?.playedAt);
      if (Number.isFinite(playedAt)) {
        mostRecentSessionAt = mostRecentSessionAt == null
          ? playedAt
          : Math.max(mostRecentSessionAt, playedAt);
      }

      const resultMode = String(play?.resultMode || "").trim();
      if (resultMode === "coop-win" || resultMode === "coop-loss") {
        coopSessions += 1;
        if (resultMode === "coop-win") coopWins += 1;
        if (resultMode === "coop-loss") coopLosses += 1;
      }

      const sessionGameIds = new Set();
      for (const value of Array.isArray(play?.playedGameIds) ? play.playedGameIds : []) {
        const gameId = String(value || "").trim();
        if (!gameId) continue;
        sessionGameIds.add(gameId);
      }

      if (sessionGameIds.size === 0) {
        const fallbackWinner = String(play?.winnerGameId || "").trim();
        if (fallbackWinner) {
          sessionGameIds.add(fallbackWinner);
        }
      }

      for (const gameId of sessionGameIds) {
        uniqueGames.add(gameId);
        playedGameCounts.set(gameId, (playedGameCounts.get(gameId) || 0) + 1);
      }

      const participantIds = new Set();
      for (const value of Array.isArray(play?.participantIds) ? play.participantIds : []) {
        const userId = String(value || "").trim();
        if (!userId) continue;
        participantIds.add(userId);
      }

      for (const entry of Array.isArray(play?.placements) ? play.placements : []) {
        const userId = String(entry?.userId || "").trim();
        if (!userId) continue;
        participantIds.add(userId);
      }

      for (const userId of participantIds) {
        appearances.set(userId, (appearances.get(userId) || 0) + 1);
      }

      if (resultMode === "ranked") {
        for (const entry of Array.isArray(play?.placements) ? play.placements : []) {
          const userId = String(entry?.userId || "").trim();
          const place = Number(entry?.place);
          if (!userId || !Number.isFinite(place) || place < 1) continue;

          const medalRow = medalCounts.get(userId) || { gold: 0, silver: 0, bronze: 0 };
          if (place === 1) medalRow.gold += 1;
          if (place === 2) medalRow.silver += 1;
          if (place === 3) medalRow.bronze += 1;
          medalCounts.set(userId, medalRow);

          if (place === 1) {
            firstPlaceCounts.set(userId, (firstPlaceCounts.get(userId) || 0) + 1);
          }

          if (place <= 3) {
            podiumCounts.set(userId, (podiumCounts.get(userId) || 0) + 1);
          }
        }
      }
    }

    const mostPlayedGames = [...playedGameCounts.entries()]
      .map(([gameId, count]) => ({
        gameId,
        title: gameTitleById.get(gameId) || gameId,
        count,
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

    const playerResults = [...appearances.entries()]
      .map(([userId, count]) => ({
        userId,
        label: participantSummaryById?.[userId]?.label || truncateUserId(userId),
        appearances: count,
        firstPlaces: firstPlaceCounts.get(userId) || 0,
        podiums: podiumCounts.get(userId) || 0,
      }))
      .sort((a, b) => {
        if (b.appearances !== a.appearances) return b.appearances - a.appearances;
        if (b.firstPlaces !== a.firstPlaces) return b.firstPlaces - a.firstPlaces;
        if (b.podiums !== a.podiums) return b.podiums - a.podiums;
        return a.label.localeCompare(b.label);
      });

    const medalTable = [...medalCounts.entries()]
      .map(([userId, medals]) => ({
        userId,
        label: participantSummaryById?.[userId]?.label || truncateUserId(userId),
        gold: medals.gold || 0,
        silver: medals.silver || 0,
        bronze: medals.bronze || 0,
      }))
      .filter((row) => row.gold > 0 || row.silver > 0 || row.bronze > 0)
      .sort((a, b) => {
        if (b.gold !== a.gold) return b.gold - a.gold;
        if (b.silver !== a.silver) return b.silver - a.silver;
        if (b.bronze !== a.bronze) return b.bronze - a.bronze;
        return a.label.localeCompare(b.label);
      });

    return {
      totalSessions,
      totalUniqueGames: uniqueGames.size,
      mostRecentSessionAt,
      coopSessions,
      coopWins,
      coopLosses,
      coopWinRate: coopSessions > 0 ? coopWins / coopSessions : 0,
      mostPlayedGames,
      playerResults,
      medalTable,
    };
  }, [sessionHistory, gameTitleById, participantSummaryById]);

  if (!stats.totalSessions) {
    return (
      <div className="ui-surface p-5 md:p-6">
        <h3 className="text-xl md:text-2xl font-semibold text-white">Statistics</h3>
        <p className="text-sm text-neutral-400 mt-2">
          No session history yet. Complete sessions to start generating group statistics.
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="ui-surface p-5 md:p-6 space-y-2">
        <h3 className="text-2xl md:text-3xl font-bold text-white">Group statistics</h3>
        <p className="text-sm text-neutral-400">
          First-pass analytics from recorded group sessions.
        </p>
      </div>

      <div className="ui-surface p-4 md:p-5 space-y-3">
        <h4 className="text-lg font-semibold text-white">Overview</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="ui-surface-subtle p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Total sessions</div>
            <div className="text-xl font-bold text-white mt-1">{stats.totalSessions}</div>
          </div>
          <div className="ui-surface-subtle p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Unique games played</div>
            <div className="text-xl font-bold text-white mt-1">{stats.totalUniqueGames}</div>
          </div>
          <div className="ui-surface-subtle p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Most recent session</div>
            <div className="text-sm font-semibold text-white mt-1">{formatDateLabel(stats.mostRecentSessionAt)}</div>
          </div>
          <div className="ui-surface-subtle p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Co-op win rate</div>
            <div className="text-xl font-bold text-white mt-1">{formatPercent(stats.coopWinRate)}</div>
          </div>
        </div>
      </div>

      <div className="ui-surface p-4 md:p-5 space-y-3">
        <h4 className="text-lg font-semibold text-white">Most Played Games</h4>
        {stats.mostPlayedGames.length === 0 ? (
          <p className="text-sm text-neutral-400">No played game records yet.</p>
        ) : (
          <div className="space-y-2">
            {stats.mostPlayedGames.slice(0, 10).map((row, index) => (
              <div
                key={row.gameId}
                className="ui-surface-subtle p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs text-neutral-500">#{index + 1}</div>
                  <div className="text-sm font-semibold text-white truncate">{row.title}</div>
                </div>
                <span className="ui-chip-muted shrink-0">{row.count} session{row.count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      <div className="ui-surface p-4 md:p-5 space-y-3">
        <h4 className="text-lg font-semibold text-white">Player Results</h4>
        <p className="text-xs text-neutral-500">1st place and podium are counted from ranked sessions only.</p>
        {stats.playerResults.length === 0 ? (
          <p className="text-sm text-neutral-400">No participant data available yet.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-700">
                  <th className="py-2 pr-3 font-medium">Player</th>
                  <th className="py-2 pr-3 font-medium">Appearances</th>
                  <th className="py-2 pr-3 font-medium">1st place</th>
                  <th className="py-2 font-medium">Podiums</th>
                </tr>
              </thead>
              <tbody>
                {stats.playerResults.map((row) => (
                  <tr key={row.userId} className="border-b border-neutral-800">
                    <td className="py-2 pr-3 text-neutral-200">{row.label}</td>
                    <td className="py-2 pr-3 text-neutral-300">{row.appearances}</td>
                    <td className="py-2 pr-3 text-neutral-300">{row.firstPlaces}</td>
                    <td className="py-2 text-neutral-300">{row.podiums}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ui-surface p-4 md:p-5 space-y-3">
        <h4 className="text-lg font-semibold text-white">Medal Table</h4>
        <p className="text-xs text-neutral-500">Medals are counted from ranked session placements only.</p>
        {stats.medalTable.length === 0 ? (
          <p className="text-sm text-neutral-400">No ranked medal placements yet.</p>
        ) : (
          <div className="overflow-auto">
            <table className="min-w-full text-sm">
              <thead>
                <tr className="text-left text-neutral-500 border-b border-neutral-700">
                  <th className="py-2 pr-3 font-medium">Player</th>
                  <th className="py-2 pr-3 font-medium">🥇</th>
                  <th className="py-2 pr-3 font-medium">🥈</th>
                  <th className="py-2 font-medium">🥉</th>
                </tr>
              </thead>
              <tbody>
                {stats.medalTable.map((row) => (
                  <tr key={`medal-${row.userId}`} className="border-b border-neutral-800">
                    <td className="py-2 pr-3 text-neutral-200">{row.label}</td>
                    <td className="py-2 pr-3 text-neutral-300">{row.gold}</td>
                    <td className="py-2 pr-3 text-neutral-300">{row.silver}</td>
                    <td className="py-2 text-neutral-300">{row.bronze}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <div className="ui-surface p-4 md:p-5 space-y-3">
        <h4 className="text-lg font-semibold text-white">Co-op Summary</h4>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-2">
          <div className="ui-surface-subtle p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Co-op sessions</div>
            <div className="text-xl font-bold text-white mt-1">{stats.coopSessions}</div>
          </div>
          <div className="ui-surface-subtle p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Co-op wins</div>
            <div className="text-xl font-bold text-emerald-300 mt-1">{stats.coopWins}</div>
          </div>
          <div className="ui-surface-subtle p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Co-op losses</div>
            <div className="text-xl font-bold text-neutral-200 mt-1">{stats.coopLosses}</div>
          </div>
          <div className="ui-surface-subtle p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Co-op win rate</div>
            <div className="text-xl font-bold text-white mt-1">{formatPercent(stats.coopWinRate)}</div>
          </div>
        </div>
      </div>
    </div>
  );
}
