function gameTitle(gameId, games) {
  const id = String(gameId || "").trim();
  if (!id) return "";
  const game = games.find((entry) => String(entry?.id || "") === id);
  return String(game?.title || "").trim() || id;
}

function playedGameTitles(play, games) {
  const ids = [
    play?.winnerGameId,
    ...(Array.isArray(play?.playedGameIds) ? play.playedGameIds : []),
  ];
  return [...new Set(ids.map((id) => String(id || "").trim()).filter(Boolean))]
    .map((id) => gameTitle(id, games));
}

export function filterGroupSessionHistory(records, games, searchText = "") {
  const history = Array.isArray(records) ? records : [];
  const gameList = Array.isArray(games) ? games : [];
  const query = String(searchText || "").trim().toLocaleLowerCase();
  const matchingHistory = query
    ? history.filter((play) =>
        playedGameTitles(play, gameList)
          .some((title) => title.toLocaleLowerCase().includes(query))
      )
    : history;

  return {
    records: matchingHistory,
    total: history.length,
    matches: matchingHistory.length,
  };
}
