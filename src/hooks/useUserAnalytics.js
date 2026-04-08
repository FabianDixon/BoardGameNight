import { useEffect, useMemo, useState } from "react";
import { collection, collectionGroup, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";
import { normalizeGameTags } from "../utils/gameTags";

function trimId(value) {
  return String(value || "").trim();
}

function isRecord(value) {
  return !!value && typeof value === "object" && !Array.isArray(value);
}

function toMillis(value) {
  if (typeof value === "number" && Number.isFinite(value)) return value;
  if (isRecord(value) && typeof value.toMillis === "function") {
    const millis = value.toMillis();
    return Number.isFinite(millis) ? millis : null;
  }
  const numeric = Number(value);
  return Number.isFinite(numeric) ? numeric : null;
}

function safeTitle(value, fallback) {
  const title = String(value || "").trim();
  return title || fallback;
}

function getUserPlacement(play, userId) {
  if (!userId) return null;

  const placements = Array.isArray(play?.placements) ? play.placements : [];
  for (const entry of placements) {
    if (!isRecord(entry)) continue;
    if (trimId(entry.userId) !== userId) continue;

    const place = toMillis(entry.place);
    if (!Number.isFinite(place) || place < 1) return null;

    return {
      userId,
      place,
    };
  }

  return null;
}

function normalizeResultMode(value, winnerGameId) {
  if (value === "ranked" || value === "coop-win" || value === "coop-loss" || value === "no-winner") {
    return value;
  }
  return winnerGameId ? "ranked" : "no-winner";
}

function getSessionGameIds(play) {
  const sessionGameIds = new Set();

  for (const value of Array.isArray(play?.playedGameIds) ? play.playedGameIds : []) {
    const gameId = trimId(value);
    if (!gameId) continue;
    sessionGameIds.add(gameId);
  }

  if (sessionGameIds.size === 0) {
    const fallbackWinner = trimId(play?.winnerGameId);
    if (fallbackWinner) {
      sessionGameIds.add(fallbackWinner);
    }
  }

  return sessionGameIds;
}

function getPlayDedupKey(play) {
  const groupId = trimId(play?.groupId);
  const playId = trimId(play?.id);
  return groupId && playId ? `${groupId}:${playId}` : "";
}

export function useUserAnalytics(userId) {
  const [groupsState, setGroupsState] = useState({
    scopeUserId: "",
    ids: [],
    ready: false,
  });
  const [playsState, setPlaysState] = useState({
    scopeKey: "",
    byGroup: new Map(),
    ready: false,
  });
  const [guestPlaysState, setGuestPlaysState] = useState({
    scopeUserId: "",
    rows: [],
    ready: false,
  });
  const [gamesState, setGamesState] = useState({
    byId: new Map(),
    ready: false,
  });
  const [collectionState, setCollectionState] = useState({
    scopeUserId: "",
    gameIds: new Set(),
    ready: false,
  });
  const [ratingsState, setRatingsState] = useState({
    scopeUserId: "",
    byGameId: new Map(),
    ready: false,
  });

  useEffect(() => {
    if (!userId) return;

    const ref = collection(db, "users", userId, "groups");

    return onSnapshot(
      ref,
      (snap) => {
        const ids = [];
        for (const docSnap of snap.docs) {
          const groupId = trimId(docSnap.id || docSnap.data()?.groupId);
          if (!groupId || ids.includes(groupId)) continue;
          ids.push(groupId);
        }
        setGroupsState({
          scopeUserId: userId,
          ids,
          ready: true,
        });
      },
      (err) => {
        console.error("Failed to load user groups for analytics:", err);
        setGroupsState({
          scopeUserId: userId,
          ids: [],
          ready: true,
        });
      }
    );
  }, [userId]);

  const groupIds = useMemo(() => {
    return groupsState.scopeUserId === userId ? groupsState.ids : [];
  }, [groupsState.ids, groupsState.scopeUserId, userId]);
  const playsScopeKey = useMemo(() => {
    return `${userId || ""}:${groupIds.join("|")}`;
  }, [userId, groupIds]);

  useEffect(() => {
    if (!userId || !groupIds.length) return;

    const pending = new Set(groupIds);
    const unsubscribers = [];

    for (const groupId of groupIds) {
      const playsRef = collection(db, "groups", groupId, "plays");
      const playsQuery = query(playsRef, where("participantIds", "array-contains", userId));

      const unsub = onSnapshot(
        playsQuery,
        (snap) => {
          const nextRows = snap.docs.map((d) => ({ id: d.id, groupId, ...d.data() }));
          const isReadyAfterThis = pending.size === 1;

          setPlaysState((prev) => {
            const next = new Map(prev.byGroup);
            next.set(groupId, nextRows);
            return {
              scopeKey: playsScopeKey,
              byGroup: next,
              ready: prev.scopeKey === playsScopeKey ? prev.ready || isReadyAfterThis : isReadyAfterThis,
            };
          });

          pending.delete(groupId);
        },
        (err) => {
          console.error(`Failed to load plays for group ${groupId}:`, err);
          const isReadyAfterThis = pending.size === 1;

          setPlaysState((prev) => {
            const next = new Map(prev.byGroup);
            next.set(groupId, []);
            return {
              scopeKey: playsScopeKey,
              byGroup: next,
              ready: prev.scopeKey === playsScopeKey ? prev.ready || isReadyAfterThis : isReadyAfterThis,
            };
          });

          pending.delete(groupId);
        }
      );

      unsubscribers.push(unsub);
    }

    return () => {
      for (const unsub of unsubscribers) {
        unsub();
      }
    };
  }, [groupIds, playsScopeKey, userId]);

  useEffect(() => {
    if (!userId) return;

    const playsQuery = query(
      collectionGroup(db, "plays"),
      where("participantIds", "array-contains", userId)
    );

    return onSnapshot(
      playsQuery,
      (snap) => {
        const rows = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
        setGuestPlaysState({
          scopeUserId: userId,
          rows,
          ready: true,
        });
      },
      (err) => {
        console.error("Failed to load participant plays for analytics:", err);
        setGuestPlaysState({
          scopeUserId: userId,
          rows: [],
          ready: true,
        });
      }
    );
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const ref = collection(db, "users", userId, "collection");

    return onSnapshot(
      ref,
      (snap) => {
        const ids = new Set();
        snap.docs.forEach((d) => {
          const gameId = trimId(d.data()?.gameId || d.id);
          if (gameId) ids.add(gameId);
        });
        setCollectionState({
          scopeUserId: userId,
          gameIds: ids,
          ready: true,
        });
      },
      (err) => {
        console.error("Failed to load collection for analytics:", err);
        setCollectionState({
          scopeUserId: userId,
          gameIds: new Set(),
          ready: true,
        });
      }
    );
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const q = query(collection(db, "ratings"), where("userId", "==", userId));

    return onSnapshot(
      q,
      (snap) => {
        const map = new Map();
        snap.forEach((d) => {
          const data = d.data() || {};
          const gameId = trimId(data.gameId);
          const value = Number(data.value);
          if (!gameId || !Number.isFinite(value)) return;
          map.set(gameId, value);
        });
        setRatingsState({
          scopeUserId: userId,
          byGameId: map,
          ready: true,
        });
      },
      (err) => {
        console.error("Failed to load ratings for analytics:", err);
        setRatingsState({
          scopeUserId: userId,
          byGameId: new Map(),
          ready: true,
        });
      }
    );
  }, [userId]);

  useEffect(() => {
    if (!userId) return;

    const ref = collection(db, "games");
    return onSnapshot(
      ref,
      (snap) => {
        const map = new Map();
        snap.forEach((d) => {
          const data = d.data() || {};
          const gameId = trimId(d.id);
          if (!gameId) return;
          map.set(gameId, {
            id: gameId,
            title: String(data.title || "").trim() || gameId,
            tags: normalizeGameTags(data.tags),
          });
        });
        setGamesState({
          byId: map,
          ready: true,
        });
      },
      (err) => {
        console.error("Failed to load games for analytics:", err);
        setGamesState({
          byId: new Map(),
          ready: true,
        });
      }
    );
  }, [userId]);

  const activePlaysByGroup = useMemo(() => {
    return playsState.scopeKey === playsScopeKey ? playsState.byGroup : new Map();
  }, [playsScopeKey, playsState.byGroup, playsState.scopeKey]);

  const activeCollectionGameIds = useMemo(() => {
    return collectionState.scopeUserId === userId ? collectionState.gameIds : new Set();
  }, [collectionState.gameIds, collectionState.scopeUserId, userId]);

  const activeRatingsByGameId = useMemo(() => {
    return ratingsState.scopeUserId === userId ? ratingsState.byGameId : new Map();
  }, [ratingsState.byGameId, ratingsState.scopeUserId, userId]);

  const activeGuestPlays = useMemo(() => {
    return guestPlaysState.scopeUserId === userId ? guestPlaysState.rows : [];
  }, [guestPlaysState.rows, guestPlaysState.scopeUserId, userId]);
  const gamesById = gamesState.byId;

  const analytics = useMemo(() => {
    if (!userId) {
      return {
        totalSessions: 0,
        lastPlayedAt: null,
        totalUniqueGames: 0,
        mostPlayedGame: null,
        playedGames: [],
        rankedSessions: 0,
        wins: 0,
        winRate: 0,
        podiumRate: 0,
        medals: { gold: 0, silver: 0, bronze: 0 },
        coopSessions: 0,
        coopWins: 0,
        coopLosses: 0,
        gameTypes: [],
        favoriteType: null,
        ratedGames: [],
      };
    }

    const dedupedPlays = new Map();

    for (const rows of activePlaysByGroup.values()) {
      for (const play of Array.isArray(rows) ? rows : []) {
        const dedupKey = getPlayDedupKey(play);
        if (!dedupKey) continue;
        dedupedPlays.set(dedupKey, play);
      }
    }

    for (const play of Array.isArray(activeGuestPlays) ? activeGuestPlays : []) {
      const dedupKey = getPlayDedupKey(play);
      if (!dedupKey) continue;
      if (!dedupedPlays.has(dedupKey)) {
        dedupedPlays.set(dedupKey, play);
      }
    }

    const allPlays = [...dedupedPlays.values()];

    const sessionCount = allPlays.length;
    let lastPlayedAt = null;

    const playedGameCounts = new Map();
    const uniqueGames = new Set();

    let rankedSessions = 0;
    let wins = 0;
    let gold = 0;
    let silver = 0;
    let bronze = 0;

    let coopSessions = 0;
    let coopWins = 0;
    let coopLosses = 0;

    const tagSessionCounts = new Map();

    for (const play of allPlays) {
      const playedAt = toMillis(play?.playedAt);
      if (Number.isFinite(playedAt)) {
        lastPlayedAt = lastPlayedAt == null ? playedAt : Math.max(lastPlayedAt, playedAt);
      }

      const winnerGameId = trimId(play?.winnerGameId);
      const resultMode = normalizeResultMode(play?.resultMode, winnerGameId);

      const participantIds = Array.isArray(play?.participantIds) ? play.participantIds : [];
      void participantIds;

      if (resultMode === "coop-win" || resultMode === "coop-loss") {
        coopSessions += 1;
        if (resultMode === "coop-win") coopWins += 1;
        if (resultMode === "coop-loss") coopLosses += 1;
      }

      const sessionGameIds = getSessionGameIds(play);
      for (const gameId of sessionGameIds) {
        uniqueGames.add(gameId);
        playedGameCounts.set(gameId, (playedGameCounts.get(gameId) || 0) + 1);
      }

      const sessionTags = new Set();
      for (const gameId of sessionGameIds) {
        const game = gamesById.get(gameId);
        const tags = Array.isArray(game?.tags) ? game.tags : [];
        for (const tag of tags) {
          const normalizedTag = trimId(tag);
          if (normalizedTag) {
            sessionTags.add(normalizedTag);
          }
        }
      }
      for (const tag of sessionTags) {
        tagSessionCounts.set(tag, (tagSessionCounts.get(tag) || 0) + 1);
      }

      if (resultMode === "ranked") {
        rankedSessions += 1;

        const myPlacement = getUserPlacement(play, userId);
        const place = toMillis(myPlacement?.place);
        if (Number.isFinite(place) && place >= 1) {
          if (place === 1) {
            wins += 1;
            gold += 1;
          }
          if (place === 2) silver += 1;
          if (place === 3) bronze += 1;
        }
      }
    }

    const playedGames = [...playedGameCounts.entries()]
      .map(([gameId, count]) => ({
        gameId,
        title: safeTitle(gamesById.get(gameId)?.title, gameId),
        count,
      }))
      .sort((a, b) => b.count - a.count || a.title.localeCompare(b.title));

    const mostPlayedGame = playedGames[0] || null;

    const gameTypes = [...tagSessionCounts.entries()]
      .map(([tag, count]) => ({ tag, count }))
      .sort((a, b) => b.count - a.count || a.tag.localeCompare(b.tag));

    const favoriteType = gameTypes[0] || null;

    const ratedGames = [...activeCollectionGameIds]
      .map((gameId) => {
        const rating = activeRatingsByGameId.get(gameId);
        if (!Number.isFinite(rating)) return null;
        return {
          gameId,
          title: safeTitle(gamesById.get(gameId)?.title, gameId),
          rating,
        };
      })
      .filter(Boolean)
      .sort((a, b) => b.rating - a.rating || a.title.localeCompare(b.title));

    return {
      totalSessions: sessionCount,
      lastPlayedAt,
      totalUniqueGames: uniqueGames.size,
      mostPlayedGame,
      playedGames,
      rankedSessions,
      wins,
      winRate: rankedSessions > 0 ? wins / rankedSessions : 0,
      podiumRate: rankedSessions > 0 ? (gold + silver + bronze) / rankedSessions : 0,
      medals: { gold, silver, bronze },
      coopSessions,
      coopWins,
      coopLosses,
      gameTypes,
      favoriteType,
      ratedGames,
    };
  }, [activeCollectionGameIds, activeGuestPlays, activePlaysByGroup, activeRatingsByGameId, gamesById, userId]);

  const groupsLoading = !!userId && (!groupsState.ready || groupsState.scopeUserId !== userId);
  const playsLoading =
    !!userId
    && groupIds.length > 0
    && (playsState.scopeKey !== playsScopeKey || !playsState.ready);
  const guestPlaysLoading = !!userId && (!guestPlaysState.ready || guestPlaysState.scopeUserId !== userId);
  const collectionLoading = !!userId && (!collectionState.ready || collectionState.scopeUserId !== userId);
  const ratingsLoading = !!userId && (!ratingsState.ready || ratingsState.scopeUserId !== userId);
  const gamesLoading = !gamesState.ready;
  const loading = !!userId && (groupsLoading || playsLoading || guestPlaysLoading || gamesLoading || ratingsLoading || collectionLoading);

  return { analytics, loading };
}
