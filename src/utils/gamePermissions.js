export function canEditGame(game, userId, isAdmin = false) {
  return !!userId && !!game && (game.createdBy === userId || isAdmin === true);
}
