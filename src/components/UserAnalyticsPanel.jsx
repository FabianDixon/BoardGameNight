import { useMemo } from "react";
import { useUserAnalytics } from "../hooks/useUserAnalytics";

const EMPTY_ANALYTICS = {
  totalSessions: 0,
  lastPlayedAt: null,
  totalUniqueGames: 0,
  mostPlayedGame: null,
  playedGames: [],
  rankedSessions: 0,
  wins: 0,
  winRate: 0,
  medals: { gold: 0, silver: 0, bronze: 0 },
  coopSessions: 0,
  coopWins: 0,
  coopLosses: 0,
  gameTypes: [],
  favoriteType: null,
  ratedGames: [],
};

function formatDateLabel(timestamp) {
  if (!Number.isFinite(timestamp)) return "-";
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

function formatRating(value) {
  if (!Number.isFinite(value)) return "-";
  return Number.isInteger(value) ? `${value}.0` : String(value);
}

export default function UserAnalyticsPanel({ userId }) {
  const { analytics, loading } = useUserAnalytics(userId);
  const stats = analytics && typeof analytics === "object" ? analytics : EMPTY_ANALYTICS;
  const hasHistory = Number(stats.totalSessions || 0) > 0;

  const visiblePlayedGames = useMemo(() => {
    const rows = Array.isArray(stats.playedGames) ? stats.playedGames : [];
    return rows.slice(0, 30);
  }, [stats.playedGames]);

  if (!userId) return null;

  if (loading) {
    return (
      <div className="ui-surface p-5 md:p-6">
        <h3 className="text-lg font-semibold text-white">Personal analytics</h3>
        <p className="text-sm text-neutral-400 mt-2">Loading your session stats across groups...</p>
      </div>
    );
  }

  if (!hasHistory) {
    return (
      <div className="ui-surface p-5 md:p-6">
        <h3 className="text-lg font-semibold text-white">Personal analytics</h3>
        <p className="text-sm text-neutral-400 mt-2">
          No cross-group session history yet. Join sessions and record results to build your profile stats.
        </p>
      </div>
    );
  }

  return (
    <div className="ui-surface p-5 md:p-6 space-y-4">
      <div>
        <h3 className="text-xl md:text-2xl font-semibold text-white">Personal analytics</h3>
        <p className="text-sm text-neutral-400 mt-1">Cross-group stats from your recorded session history.</p>
      </div>

      <div className="ui-surface-subtle p-4 space-y-3">
        <h4 className="text-base font-semibold text-white">Sessions</h4>
        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Total sessions</div>
            <div className="text-xl font-bold text-white mt-1">{stats.totalSessions}</div>
          </div>
          <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Last played</div>
            <div className="text-sm font-semibold text-white mt-1">{formatDateLabel(stats.lastPlayedAt)}</div>
          </div>
        </div>
      </div>

      <div className="ui-surface-subtle p-4 space-y-3">
        <h4 className="text-base font-semibold text-white">Games</h4>

        <div className="grid grid-cols-2 gap-2">
          <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Unique games</div>
            <div className="text-xl font-bold text-white mt-1">{stats.totalUniqueGames}</div>
          </div>
          <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
            <div className="text-xs uppercase tracking-wide text-neutral-500">Most played</div>
            {stats.mostPlayedGame ? (
              <>
                <div className="text-sm font-semibold text-white mt-1 truncate">{stats.mostPlayedGame.title}</div>
                <div className="text-xs text-neutral-400 mt-0.5">{stats.mostPlayedGame.count} session{stats.mostPlayedGame.count === 1 ? "" : "s"}</div>
              </>
            ) : (
              <div className="text-sm text-neutral-400 mt-1">-</div>
            )}
          </div>
        </div>

        {visiblePlayedGames.length > 0 && (
          <div className="space-y-2">
            {visiblePlayedGames.map((row, index) => (
              <div
                key={row.gameId}
                className="rounded-xl border border-neutral-700 bg-neutral-900 p-3 flex items-center justify-between gap-3"
              >
                <div className="min-w-0">
                  <div className="text-xs text-neutral-500">#{index + 1}</div>
                  <div className="text-sm font-medium text-white truncate">{row.title}</div>
                </div>
                <span className="ui-chip-muted shrink-0">{row.count} session{row.count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        )}
      </div>

      {Number(stats.rankedSessions || 0) > 0 && (
        <div className="ui-surface-subtle p-4 space-y-3">
          <h4 className="text-base font-semibold text-white">Placements and results</h4>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Ranked sessions</div>
              <div className="text-xl font-bold text-white mt-1">{stats.rankedSessions}</div>
            </div>
            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Win rate</div>
              <div className="text-xl font-bold text-white mt-1">{formatPercent(stats.winRate)}</div>
            </div>
            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Podium rate</div>
              <div className="text-xl font-bold text-white mt-1">{formatPercent(stats.podiumRate)}</div>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-2">
            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Gold</div>
              <div className="text-xl font-bold text-amber-300 mt-1">{stats.medals?.gold || 0}</div>
            </div>
            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Silver</div>
              <div className="text-xl font-bold text-neutral-200 mt-1">{stats.medals?.silver || 0}</div>
            </div>
            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3 col-span-2">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Bronze</div>
              <div className="text-xl font-bold text-amber-600 mt-1">{stats.medals?.bronze || 0}</div>
            </div>
          </div>
        </div>
      )}

      {Number(stats.coopSessions || 0) > 0 && (
        <div className="ui-surface-subtle p-4 space-y-3">
          <h4 className="text-base font-semibold text-white">Co-op record</h4>
          <div className="grid grid-cols-3 gap-2">
            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Sessions</div>
              <div className="text-xl font-bold text-white mt-1">{stats.coopSessions}</div>
            </div>
            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Wins</div>
              <div className="text-xl font-bold text-emerald-300 mt-1">{stats.coopWins}</div>
            </div>
            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Losses</div>
              <div className="text-xl font-bold text-neutral-200 mt-1">{stats.coopLosses}</div>
            </div>
          </div>
        </div>
      )}

      {(Array.isArray(stats.gameTypes) ? stats.gameTypes.length : 0) > 0 && (
        <div className="ui-surface-subtle p-4 space-y-3">
          <h4 className="text-base font-semibold text-white">Game types</h4>
          {stats.favoriteType && (
            <div className="rounded-xl border border-neutral-700 bg-neutral-900 p-3">
              <div className="text-xs uppercase tracking-wide text-neutral-500">Favorite type</div>
              <div className="text-sm font-semibold text-white mt-1">{stats.favoriteType.tag}</div>
              <div className="text-xs text-neutral-400 mt-0.5">{stats.favoriteType.count} session{stats.favoriteType.count === 1 ? "" : "s"}</div>
            </div>
          )}

          <div className="space-y-2">
            {(Array.isArray(stats.gameTypes) ? stats.gameTypes : []).map((row) => (
              <div
                key={row.tag}
                className="rounded-xl border border-neutral-700 bg-neutral-900 p-3 flex items-center justify-between gap-3"
              >
                <span className="text-sm font-medium text-white">{row.tag}</span>
                <span className="ui-chip-muted">{row.count} session{row.count === 1 ? "" : "s"}</span>
              </div>
            ))}
          </div>
        </div>
      )}

      {(Array.isArray(stats.ratedGames) ? stats.ratedGames.length : 0) > 0 && (
        <div className="ui-surface-subtle p-4 space-y-3">
          <h4 className="text-base font-semibold text-white">Rated games</h4>
          <div className="space-y-2">
            {(Array.isArray(stats.ratedGames) ? stats.ratedGames : []).map((row) => (
              <div
                key={row.gameId}
                className="rounded-xl border border-neutral-700 bg-neutral-900 p-3 flex items-center justify-between gap-3"
              >
                <span className="text-sm font-medium text-white min-w-0 truncate">{row.title}</span>
                <span className="ui-chip-muted shrink-0">{formatRating(row.rating)} / 5</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
