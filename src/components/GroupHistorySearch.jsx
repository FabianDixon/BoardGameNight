import { useId, useState } from "react";
import { filterGroupSessionHistory } from "../utils/groupHistorySearch";

export default function GroupHistorySearch({
  records = [],
  games = [],
  children,
  loading = false,
  error = null,
  onRetry,
}) {
  const [query, setQuery] = useState("");
  const inputId = useId();
  const statusId = useId();
  const results = filterGroupSessionHistory(records, games, query);
  const hasQuery = query.trim().length > 0;

  return (
    <section
      className="space-y-4"
      aria-label="Group session history"
      aria-busy={loading}
    >
      {loading ? (
        <div className="ui-surface p-5 text-sm text-neutral-300" role="status">
          Loading session history…
        </div>
      ) : error ? (
        <div className="ui-surface p-5 text-sm text-red-300" role="alert">
          <p>Couldn't load session history.</p>
          {onRetry && (
            <button type="button" className="mt-2 text-blue-400 hover:underline" onClick={onRetry}>
              Retry
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="ui-surface p-4">
            <label htmlFor={inputId} className="block text-sm font-medium text-neutral-200 mb-2">
              Search played games
            </label>
            <div className="flex items-center gap-2">
              <input
                id={inputId}
                type="search"
                className="w-full"
                placeholder="Search played games…"
                value={query}
                onChange={(event) => setQuery(event.target.value)}
                aria-describedby={statusId}
              />
              {query && (
                <button
                  type="button"
                  className="ui-btn-secondary px-3 py-2 text-sm shrink-0"
                  onClick={() => setQuery("")}
                  aria-label="Clear history search"
                >
                  Clear
                </button>
              )}
            </div>
            {hasQuery && results.total > 0 && (
              <p id={statusId} className="mt-2 text-xs text-neutral-400" role="status" aria-live="polite">
                Showing {results.matches} of {results.total} session{results.total === 1 ? "" : "s"}.
              </p>
            )}
            {(!hasQuery || results.total === 0) && <span id={statusId} className="sr-only" />}
          </div>

          {hasQuery && results.total > 0 && results.matches === 0 ? (
            <p className="ui-surface p-5 text-sm text-neutral-300" role="status" aria-live="polite">
              No sessions match “{query.trim()}”.
            </p>
          ) : (
            typeof children === "function" ? children(results.records) : children
          )}
        </>
      )}
    </section>
  );
}
