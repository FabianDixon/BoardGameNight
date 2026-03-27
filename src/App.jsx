// src/App.jsx
import { useEffect, useMemo, useState, useCallback, useRef } from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  endAt,
  getDoc,
  getDocFromServer,
  getDocs,
  increment,
  limit,
  onSnapshot,
  orderBy,
  query,
  startAt,
  setDoc,
  updateDoc,
  writeBatch,
  runTransaction,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { db } from "./firebase";
import { pickWeightedWinner, DEFAULT_WEIGHTS } from "./weights/weighting";
import { useMyRatings } from "./hooks/useMyRatings";
import { useMyCollection } from "./hooks/useMyCollection";
import { useGames } from "./hooks/useGames";
import { useGroupMembers } from "./hooks/useGroupMembers";
import { useGroupSettings } from "./hooks/useGroupSettings";
import { useGroupWeights } from "./hooks/useGroupWeights";
import { useGroupGames } from "./hooks/useGroupGames";
import { useGroupVotes } from "./hooks/useGroupVotes";
import { useGroupPool } from "./hooks/useGroupPool";
import { useVoteBallots } from "./hooks/useVoteBallots";
import { useSessionSubmissions } from "./hooks/useSessionSubmissions";
import { useMySubmission } from "./hooks/useMySubmission";
import { useSessionMeta } from "./hooks/useSessionMeta";
import { useGroupSessionHistory } from "./hooks/useGroupSessionHistory";

import ProfileCard from "./components/ProfileCard";
import AddGameForm from "./components/AddGameForm";
import GameCard from "./components/GameCard";
import GameDetail from "./components/GameDetail";
import GroupDetail from "./components/GroupDetail";
import GroupsPanel from "./components/GroupsPanel";
import VotingPanel from "./components/VotingPanel";
import GroupStatisticsPanel from "./components/GroupStatisticsPanel";
import GroupToolsPanel from "./components/GroupToolsPanel";
import Toast from "./components/ui/Toast";
import Fab from "./components/ui/Fab";
import GroupSettingsPanel from "./components/GroupSettingsPanel";
import PastSessionEditModal from "./components/PastSessionEditModal";
import { buildSessionMailto, copyJsonToClipboard } from "./utils/emailExport";
import GameTagsField from "./components/GameTagsField";
import GameTagFilter from "./components/GameTagFilter";
import { normalizeGameTags, getUniqueTagsFromGames } from "./utils/gameTags";
import { VOTE_STATUS, APP_TAB, GROUP_VIEW, GROUP_TAB } from "./constants/workflow";
import {
  DEFAULT_AVATAR_ID,
  avatarById,
  avatarIconById,
  isValidAvatarId,
} from "./constants/avatars";

const auth = getAuth();

function Modal({ open, title, onClose, children, dismissible = true }) {
  if (!open) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      role="dialog"
      aria-modal="true"
    >
      {/* Only allow backdrop click if dismissible */}
      <div
        className="ui-modal-backdrop"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
        style={{
          pointerEvents: dismissible ? "auto" : "none",
        }}
      />

      <div className="ui-modal-shell">
        <div className="ui-modal-header">
          <h2 className="text-lg font-semibold text-white">{title}</h2>

          {dismissible && (
            <button
              className="ui-btn-secondary px-3 py-1"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>

        <div className="ui-modal-body">{children}</div>
      </div>
    </div>
  );
}

function normalizePlayedGameIds(playedGameIds, winnerGameId) {
  const winnerId = typeof winnerGameId === "string" && winnerGameId.trim()
    ? winnerGameId.trim()
    : null;

  const uniqueIds = [];
  for (const value of Array.isArray(playedGameIds) ? playedGameIds : []) {
    const id = String(value || "").trim();
    if (!id || uniqueIds.includes(id)) continue;
    uniqueIds.push(id);
  }

  if (!winnerId) return uniqueIds;

  return [winnerId, ...uniqueIds.filter((id) => id !== winnerId)];
}

const SESSION_RESULT_MODES = new Set([
  "ranked",
  "coop-win",
  "coop-loss",
  "no-winner",
]);

function defaultResultMode(winnerGameId) {
  return winnerGameId ? "ranked" : "no-winner";
}

function normalizeResultMode(value, fallbackMode) {
  return SESSION_RESULT_MODES.has(value) ? value : fallbackMode;
}

function normalizePlacements(placements, resultMode) {
  const mode = normalizeResultMode(resultMode, "no-winner");

  if (mode === "coop-loss" || mode === "no-winner") {
    return [];
  }

  const deduped = new Map();

  for (const entry of Array.isArray(placements) ? placements : []) {
    const userId = String(entry?.userId || "").trim();
    if (!userId) continue;

    const placeValue = Number(entry?.place);
    if (!Number.isFinite(placeValue) || placeValue < 1) continue;

    deduped.set(userId, {
      userId,
      place: mode === "coop-win" ? 1 : Math.floor(placeValue),
    });
  }

  return [...deduped.values()].sort((a, b) => {
    if (a.place !== b.place) return a.place - b.place;
    return a.userId.localeCompare(b.userId);
  });
}

function normalizeParticipantIds(participantIds, fallbackIds = []) {
  const uniqueIds = [];

  for (const value of Array.isArray(participantIds) ? participantIds : []) {
    const id = String(value || "").trim();
    if (!id || uniqueIds.includes(id)) continue;
    uniqueIds.push(id);
  }

  if (uniqueIds.length > 0) return uniqueIds;

  const fallbackUnique = [];
  for (const value of Array.isArray(fallbackIds) ? fallbackIds : []) {
    const id = String(value || "").trim();
    if (!id || fallbackUnique.includes(id)) continue;
    fallbackUnique.push(id);
  }

  return fallbackUnique;
}

function truncateUserId(userId) {
  const value = String(userId || "").trim();
  if (!value) return "Unknown user";
  if (value.length <= 12) return value;
  return `${value.slice(0, 6)}…${value.slice(-4)}`;
}

function normalizeParticipantPlacements(placements, resultMode, participantIds) {
  const normalized = normalizePlacements(placements, resultMode);
  const allowed = new Set(normalizeParticipantIds(participantIds));
  if (!allowed.size) return normalized;
  return normalized.filter((entry) => allowed.has(entry.userId));
}

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [nickname, setNickname] = useState("");

  const [showAuthPrompt, setShowAuthPrompt] = useState(false);
  const [savedAccountRequiredOpen, setSavedAccountRequiredOpen] = useState(false);

  const games = useGames(user);
  const [selectedGame, setSelectedGame] = useState(null);

  const myCollection = useMyCollection(user);

  const [activeTab, setActiveTab] = useState(APP_TAB.LIBRARY); // library | collection | group | profile

  const [searchQuery, setSearchQuery] = useState("");
  const [selectedTagFilters, setSelectedTagFilters] = useState([]);

  const [myGroups, setMyGroups] = useState([]);
  const [currentGroupId, setCurrentGroupId] = useState("");
  const [groupAccessReady, setGroupAccessReady] = useState(false);

  const members = useGroupMembers(user, currentGroupId, groupAccessReady);
  const [memberProfilesById, setMemberProfilesById] = useState({});
  const [directoryProfilesById, setDirectoryProfilesById] = useState({});

  const [groupView, setGroupView] = useState(GROUP_VIEW.PICKER); // "picker" | "detail"
  const [groupTab, setGroupTab] = useState(GROUP_TAB.COLLECTION);

  const groupGameRefs = useGroupGames(currentGroupId, groupAccessReady);
  const groupWeightOverrides = useGroupWeights(currentGroupId, groupAccessReady);
  const groupSettings = useGroupSettings(user, currentGroupId, groupAccessReady);

  const votes = useGroupVotes(currentGroupId, groupAccessReady);

  const activeVote = useMemo(() => {
    if (!votes.length) return null;
    return (
      votes.find(v => v.status === VOTE_STATUS.COLLECTING) ||
      votes.find(v => v.status === VOTE_STATUS.OPEN) ||
      votes[0] // last closed (latest)
    );
  }, [votes]);

  const { myBallot, voteBallots } = useVoteBallots(user, currentGroupId, activeVote?.id, groupAccessReady);

  const [winnerModal, setWinnerModal] = useState(null);
  const [sessionPlayRecord, setSessionPlayRecord] = useState(null);
  const [isSavingSessionPlay, setIsSavingSessionPlay] = useState(false);

  const [editingPastPlay, setEditingPastPlay] = useState(null);
  const [isSavingPastPlay, setIsSavingPastPlay] = useState(false);

  const poolDocs = useGroupPool(currentGroupId, groupAccessReady);
  const mySubmissionGameId = useMySubmission(user?.uid, currentGroupId, activeVote?.id, groupAccessReady);
  const sessionSubmissions = useSessionSubmissions(currentGroupId, activeVote?.id, activeVote?.status, groupAccessReady);

  const [mySharedGameIdsInCurrentGroup, setMySharedGameIdsInCurrentGroup] = useState(new Set());

  const sessionMeta = useSessionMeta(currentGroupId, groupAccessReady);
  const sessionHistory = useGroupSessionHistory(currentGroupId, groupAccessReady);

  const [isAddGameOpen, setIsAddGameOpen] = useState(false);
  const [addGameForm, setAddGameForm] = useState({
    title: "",
    description: "",
    imageUrl: "",
    tags: [],
  });

  const myRatings = useMyRatings(user);

  const [toasts, setToasts] = useState([]);

  const [isEditGameOpen, setIsEditGameOpen] = useState(false);
  const [editGameForm, setEditGameForm] = useState({
    id: "",
    title: "",
    description: "",
    imageUrl: "",
    tags: [],
  });

  const [isDeletingGame, setIsDeletingGame] = useState(false);

  const [returnCtx, setReturnCtx] = useState(null);
  const isTemporaryAccount = !!user?.isAnonymous;

  // Derived: current group document (null if not found)
  // NOTE: Can be null if currentGroupId is set but group was removed from myGroups.
  // All permission checks must handle null gracefully.
  const currentGroup = useMemo(
    () => myGroups.find((g) => g.id === currentGroupId) || null,
    [myGroups, currentGroupId]
  );

  // Derived: whether we have a valid, loaded group currently selected
  const hasValidGroupSelection = Boolean(currentGroupId && currentGroup);

  const canManageSession = useMemo(() => {
    if (!user || !activeVote) return false;
    const isVoteOwner = activeVote.createdBy === user.uid;
    const isGroupOwner = currentGroup?.ownerId === user.uid;
    return isVoteOwner || isGroupOwner;
  }, [user, activeVote, currentGroup]);

  const canCloseActiveVote = useMemo(() => {
    if (!user || !activeVote || activeVote.status !== VOTE_STATUS.OPEN) return false;
    const isVoteOwner = activeVote.createdBy === user.uid;
    const isGroupOwner = currentGroup?.ownerId === user.uid;
    return isVoteOwner || isGroupOwner;
  }, [user, activeVote, currentGroup]);

  // --- Auth + Profile ---
  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (u) => {
      if (u) {
        setUser(u);
        setShowAuthPrompt(false);

        // profile load (keep your existing logic)
        try {
          const ref = doc(db, "users", u.uid);
          const snap = await getDoc(ref);

          if (!snap.exists()) {
            await setDoc(ref, { nickname: "", avatarId: DEFAULT_AVATAR_ID, createdAt: Date.now() });
            setProfile({ nickname: "", avatarId: DEFAULT_AVATAR_ID });
            setNickname("");
            await setDoc(
              doc(db, "userDirectory", u.uid),
              {
                userId: u.uid,
                nickname: "",
                nicknameLower: "",
                avatarId: DEFAULT_AVATAR_ID,
                isAnonymous: !!u.isAnonymous,
                updatedAt: Date.now(),
              },
              { merge: true }
            );
            return;
          }

          const data = snap.data();
          const normalizedAvatarId = isValidAvatarId(data?.avatarId)
            ? data.avatarId
            : DEFAULT_AVATAR_ID;
          setProfile({
            ...data,
            avatarId: normalizedAvatarId,
          });
          setNickname(data.nickname || "");
          await setDoc(
            doc(db, "userDirectory", u.uid),
            {
              userId: u.uid,
              nickname: String(data?.nickname || "").trim(),
              nicknameLower: String(data?.nickname || "").trim().toLowerCase(),
              avatarId: normalizedAvatarId,
              isAnonymous: !!u.isAnonymous,
              updatedAt: Date.now(),
            },
            { merge: true }
          );
        } catch (err) {
          console.error("Failed to load profile:", err);
        }

        return;
      }

      // No user currently signed in
      setUser(null);
      setProfile(null);

      const choice = localStorage.getItem("bgng_auth_choice") || "";

      if (choice === "guest") {
        // user previously chose guest
        signInAnonymously(auth);
        return;
      }

      // show prompt (default)
      setShowAuthPrompt(true);
    });

    return unsub;
  }, []);

  // --- My groups + group docs ---
  useEffect(() => {
    if (!user) return;

    const ref = collection(db, "users", user.uid, "groups");
    const unsub = onSnapshot(ref, async (snap) => {
      const ids = snap.docs.map((d) => d.id);

      const groupDocsRaw = await Promise.all(
        ids.map(async (id) => {
          const gSnap = await getDoc(doc(db, "groups", id));
          if (!gSnap.exists()) return null;
          return { id, ...gSnap.data() };
        })
      );

      const groupDocs = groupDocsRaw.filter(Boolean);
      const validIds = groupDocs.map((group) => group.id);

      setMyGroups(groupDocs);

      setCurrentGroupId((prev) => {
        if (!prev && validIds.length > 0) return validIds[0];
        if (prev && validIds.length > 0 && !validIds.includes(prev)) return validIds[0];
        if (validIds.length === 0) return "";
        return prev;
      });
    });

    return unsub;
  }, [user]);

  const syncMyNicknameToGroupMemberships = useCallback(
    async (nextNickname) => {
      if (!user) return;
      const nick = (nextNickname ?? profile?.nickname ?? "").trim();
      if (!nick) return;

      const batch = writeBatch(db);

      for (const g of myGroups) {
        batch.set(
          doc(db, "groups", g.id, "members", user.uid),
          { nickname: nick },
          { merge: true }
        );
      }

      await batch.commit();
    },
    [user, profile?.nickname, myGroups]
  );

  const syncMyAvatarToGroupMemberships = useCallback(
    async (nextAvatarId) => {
      if (!user) return;
      const avatarId = isValidAvatarId(nextAvatarId) ? nextAvatarId : DEFAULT_AVATAR_ID;

      const batch = writeBatch(db);

      for (const g of myGroups) {
        batch.set(
          doc(db, "groups", g.id, "members", user.uid),
          { avatarId },
          { merge: true }
        );
      }

      await batch.commit();
    },
    [user, myGroups]
  );

  // --Suscribe to settings --

  // -- Group members --

// --- Materialized group collection ---

  // --- Ballots for active vote ---


  // Validated group selection helper - ensures group exists before setting
  const selectGroup = useCallback((groupId) => {
    if (!groupId) {
      setCurrentGroupId("");
      return;
    }

    const isValid = myGroups.some((g) => g.id === groupId);
    if (isValid) {
      setCurrentGroupId(groupId);
    } else {
      console.warn("Attempted to select invalid group ID:", groupId);
    }
  }, [myGroups]);

  // Guard: if on group detail view but no valid group selected, return to picker
  // (handles edge case: user's last group was removed, or direct navigation to detail with no group)
  useEffect(() => {
    if (activeTab !== APP_TAB.GROUP) return;

    if (groupView === GROUP_VIEW.DETAIL && !hasValidGroupSelection) {
      setGroupView(GROUP_VIEW.PICKER);
    }
  }, [activeTab, groupView, hasValidGroupSelection]);

  useEffect(() => {
    if (!isTemporaryAccount) return;
    if (activeTab !== APP_TAB.GROUP) return;

    setActiveTab(APP_TAB.LIBRARY);
    setGroupView(GROUP_VIEW.PICKER);
    setSavedAccountRequiredOpen(true);
  }, [isTemporaryAccount, activeTab]);

  // Sync nickname to all group memberships when profile updates
  useEffect(() => {
    if (!user?.uid || !profile?.nickname || myGroups.length === 0) return;
    syncMyNicknameToGroupMemberships(profile.nickname).catch(console.error);
  }, [user?.uid, profile?.nickname, myGroups.length, syncMyNicknameToGroupMemberships]);

  useEffect(() => {
    const rows = (members || []).map((member) => {
      const userId = String(member?.userId || "").trim();
      if (!userId) return null;
      return [userId, { avatarId: member?.avatarId || null }];
    }).filter(Boolean);

    setMemberProfilesById(Object.fromEntries(rows));
  }, [members]);

  const memberById = useMemo(() => {
    const map = new Map();
    for (const member of members || []) {
      const userId = String(member?.userId || "").trim();
      if (!userId) continue;
      map.set(userId, member);
    }
    return map;
  }, [members]);

  const groupMemberIds = useMemo(() => {
    return (members || [])
      .map((member) => String(member?.userId || "").trim())
      .filter(Boolean);
  }, [members]);

  useEffect(() => {
    if (!user?.uid || !profile?.avatarId || myGroups.length === 0) return;
    syncMyAvatarToGroupMemberships(profile.avatarId).catch(console.error);
  }, [user?.uid, profile?.avatarId, myGroups.length, syncMyAvatarToGroupMemberships]);

  // Gate group-dependent reads: wait for membership doc to be visible server-side
  // This prevents permission-denied errors from hooks that subscribe to group data
  // before the membership document is fully propagated.
  useEffect(() => {
    let cancelled = false;

    async function checkAccess() {
      if (!user?.uid || !currentGroupId) {
        setGroupAccessReady(false);
        return;
      }

      // Optimization: avoid unnecessary reset if we're already checking this group
      // (reduces downstream hook churn when switching between valid groups)
      setGroupAccessReady(false);

      try {
        const memberRef = doc(db, "groups", currentGroupId, "members", user.uid);
        await waitForServerDoc(memberRef, { timeoutMs: 4000, intervalMs: 200 });

        if (!cancelled) setGroupAccessReady(true);
      } catch (e) {
        console.warn("groupAccessReady: membership not visible yet", e);
        if (!cancelled) setGroupAccessReady(false);
      }
    }

    checkAccess();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, currentGroupId]);

  const autoStartRef = useRef({ voteId: null });
  const autoCloseRef = useRef({ voteId: null });

  // --- Derived views ---
  const selectedGameFresh = useMemo(() => {
    if (!selectedGame) return null;
    return games.find((g) => g.id === selectedGame.id) || selectedGame;
  }, [games, selectedGame]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  // Helper: check if a game matches the search query (title + tags, not description)
  function matchesSearchQuery(game, query) {
    if (!query) return true;
    if (game.title?.toLowerCase().includes(query)) return true;
    const tags = normalizeGameTags(game.tags);
    for (const tag of tags) {
      if (tag.includes(query)) return true;
    }
    return false;
  }

  // Helper: check if a game matches ALL selected tags (ALL-match semantics)
  function matchesAnyTag(game) {
    if (selectedTagFilters.length === 0) return true;
    const tags = normalizeGameTags(game.tags);
    return selectedTagFilters.every((selectedTag) => tags.includes(selectedTag));
  }

  const libraryGames = useMemo(() => {
    return games.filter((g) =>
      matchesSearchQuery(g, normalizedQuery) && matchesAnyTag(g)
    );
  }, [games, normalizedQuery, selectedTagFilters]);

  const collectionGames = useMemo(() => {
    const base = games.filter((g) => myCollection.has(g.id));
    return base.filter((g) =>
      matchesSearchQuery(g, normalizedQuery) && matchesAnyTag(g)
    );
  }, [games, myCollection, normalizedQuery, selectedTagFilters]);

  const groupGames = useMemo(() => {
    if (!currentGroupId) return [];

    const gameMap = new Map(games.map((g) => [g.id, g]));
    const poolMap = new Map(poolDocs.map((p) => [p.id, p])); // <-- merge in pool state

    return groupGameRefs
      .filter((gg) => (gg.ownersCount || 0) > 0) // hide 0-owner leftovers
      .map((gg) => {
        const base = gameMap.get(gg.id);
        if (!base) return null;

        const pool = poolMap.get(gg.id) || {};

        return {
          ...base,
          groupOwnersCount: gg.ownersCount || 0,

          // group/pool-specific fields (used by weighting + your toggle UI)
          playedOverride: !!pool.playedOverride,
          playedCount: Number(pool.playedCount || 0),
          cycleVoteCount: Number(pool.cycleVoteCount || 0),
          lifetimeVoteCount: Number(pool.lifetimeVoteCount || 0),
          cycleStartedSession: pool.cycleStartedSession ?? null,
          lastWonSession: pool.lastWonSession ?? null,
          isActiveInPool: !!pool.isActive,
        };
      })
      .filter(Boolean);
  }, [currentGroupId, games, groupGameRefs, poolDocs]);

  const groupAvailableTags = useMemo(() => {
    return getUniqueTagsFromGames(groupGames);
  }, [groupGames]);

  useEffect(() => {
    let cancelled = false;

    async function loadMySharedGameIds() {
      if (!user?.uid || !currentGroupId || !groupAccessReady) {
        setMySharedGameIdsInCurrentGroup(new Set());
        return;
      }

      try {
        // Only check games that currently exist in this group's materialized collection
        const ids = (groupGameRefs || []).map((r) => r.id).filter(Boolean);
        if (ids.length === 0) {
          setMySharedGameIdsInCurrentGroup(new Set());
          return;
        }

        const checks = await Promise.allSettled(
          ids.map((gameId) =>
            getDoc(doc(db, "groups", currentGroupId, "games", gameId, "owners", user.uid))
          )
        );

        const s = new Set();
        for (let i = 0; i < checks.length; i++) {
          const res = checks[i];
          if (res.status === "fulfilled" && res.value.exists()) {
            s.add(ids[i]);
          }
        }

        if (!cancelled) setMySharedGameIdsInCurrentGroup(s);
      } catch (err) {
        console.warn("Failed to load my shared games for this group:", err);
        if (!cancelled) setMySharedGameIdsInCurrentGroup(new Set());
      }
    }

    loadMySharedGameIds();
    return () => {
      cancelled = true;
    };
  }, [user?.uid, currentGroupId, groupAccessReady, groupGameRefs]);

  const myRole = useMemo(() => {
    const me = members.find((m) => m.userId === user?.uid);
    return me?.role || "member";
  }, [members, user]);

  const canEditWeights = useMemo(() => {
    if (!user || !currentGroupId) return false;
    if (currentGroup?.ownerId === user.uid) return true;
    return myRole === "moderator" && groupSettings?.moderatorsCanEditWeights === true;
  }, [user, currentGroupId, currentGroup, myRole, groupSettings]);

  const canEditGroupMeta = useMemo(() => {
    return !!user && currentGroup?.ownerId === user.uid;
  }, [user, currentGroup]);

  // Who can edit past session play records: group owner or moderator
  const canEditPastSession = useMemo(() => {
    if (!user || !currentGroupId) return false;
    if (currentGroup?.ownerId === user.uid) return true;
    return myRole === "moderator";
  }, [user, currentGroupId, currentGroup, myRole]);

  const voteResults = useMemo(() => {
    if (!activeVote || activeVote.status !== VOTE_STATUS.CLOSED) return [];

    const gameMap = new Map(games.map((g) => [g.id, g]));

    // Prefer authoritative scoreBreakdown stored on the vote doc
    const breakdown = Array.isArray(activeVote.scoreBreakdown)
      ? activeVote.scoreBreakdown
      : null;

    if (breakdown && breakdown.length > 0) {
      return breakdown
        .map((r) => ({
          gameId: r.gameId,
          title: gameMap.get(r.gameId)?.title || r.gameId,
          // pickWeightedWinner should provide these; we keep them optional
          score: Number(r.score ?? 0),
          votes: Number(r.sessionVotes ?? r.votes ?? 0),
          isWinner: activeVote.winnerGameId === r.gameId,
        }))
        .filter((r) => r.votes > 0 || r.score > 0)
        .sort((a, b) => b.score - a.score);
    }

    // Fallback: count ballots (old votes)
    const counts = new Map();
    for (const b of voteBallots) {
      if (!b.gameId) continue;
      counts.set(b.gameId, (counts.get(b.gameId) || 0) + 1);
    }

    return [...counts.entries()]
      .map(([gameId, votes]) => ({
        gameId,
        title: gameMap.get(gameId)?.title || gameId,
        votes,
        score: votes, // no weights available in old data
        isWinner: activeVote.winnerGameId === gameId,
      }))
      .filter((r) => r.votes > 0 || r.score > 0)
      .sort((a, b) => b.score - a.score);
  }, [activeVote, voteBallots, games]);

  const poolActiveIds = useMemo(() => {
    return new Set(poolDocs.filter((p) => p.isActive).map((p) => p.id));
  }, [poolDocs]);

  const submittedGameIds = useMemo(() => {
    return new Set(sessionSubmissions.map((s) => s.gameId).filter(Boolean));
  }, [sessionSubmissions]);

  const activePoolGameIds = useMemo(() => {
    return Array.from(poolActiveIds);
  }, [poolActiveIds]);

  const effectiveWeights = useMemo(() => {
    return { ...DEFAULT_WEIGHTS, ...(groupWeightOverrides || {}) };
  }, [groupWeightOverrides]);

  const canEmailExport = useMemo(() => {
    if (!user) return false;
    if (user.isAnonymous) return false;
    return !!user.email; // linked email account
  }, [user]);

  const groupMemberCount = useMemo(() => {
    // members array is your group membership docs
    return Array.isArray(members) ? members.length : 0;
  }, [members]);

  const submissionsCount = useMemo(() => {
    // unique users that submitted
    const uids = new Set(sessionSubmissions.map((s) => s.userId).filter(Boolean));
    return uids.size;
  }, [sessionSubmissions]);

  const ballotsCount = useMemo(() => {
    // unique users that voted
    const uids = new Set(voteBallots.map((b) => b.userId).filter(Boolean));
    return uids.size;
  }, [voteBallots]);

  const sessionIndex = useMemo(
    () => Number(sessionMeta?.sessionIndex || 0),
    [sessionMeta?.sessionIndex]
  );

  useEffect(() => {
    if (!currentGroupId || !activeVote?.id || activeVote.status !== VOTE_STATUS.CLOSED) {
      setSessionPlayRecord(null);
      return;
    }

    const playRef = doc(db, "groups", currentGroupId, "plays", activeVote.id);

    const unsub = onSnapshot(
      playRef,
      (snap) => {
        if (!snap.exists()) {
          setSessionPlayRecord(null);
          return;
        }

        const data = snap.data() || {};
        const winnerGameId = typeof data.winnerGameId === "string"
          ? data.winnerGameId
          : (activeVote?.winnerGameId || null);
        const resultMode = normalizeResultMode(
          data.resultMode,
          defaultResultMode(winnerGameId)
        );
        const participantIds = normalizeParticipantIds(
          data.participantIds,
          groupMemberIds
        );

        setSessionPlayRecord({
          id: snap.id,
          ...data,
          winnerGameId,
          resultMode,
          participantIds,
          playedGameIds: normalizePlayedGameIds(data.playedGameIds, winnerGameId),
          placements: normalizeParticipantPlacements(data.placements, resultMode, participantIds),
        });
      },
      (err) => {
        console.error("Failed to load session play record:", err);
        setSessionPlayRecord(null);
      }
    );

    return unsub;
  }, [
    currentGroupId,
    activeVote?.id,
    activeVote?.status,
    activeVote?.winnerGameId,
    groupMemberIds,
  ]);

  const normalizedSessionHistory = useMemo(() => {
    return (sessionHistory || []).map((play) => {
      const winnerGameId =
        typeof play?.winnerGameId === "string" && play.winnerGameId.trim()
          ? play.winnerGameId.trim()
          : null;
      const resultMode = normalizeResultMode(
        play?.resultMode,
        defaultResultMode(winnerGameId)
      );
      const participantIds = normalizeParticipantIds(play?.participantIds, groupMemberIds);

      return {
        ...play,
        winnerGameId,
        resultMode,
        participantIds,
        playedGameIds: normalizePlayedGameIds(play?.playedGameIds, winnerGameId),
        placements: normalizeParticipantPlacements(play?.placements, resultMode, participantIds),
      };
    });
  }, [sessionHistory, groupMemberIds]);

  const knownParticipantIds = useMemo(() => {
    const ids = new Set(groupMemberIds);

    for (const userId of normalizeParticipantIds(sessionPlayRecord?.participantIds, groupMemberIds)) {
      ids.add(userId);
    }

    for (const play of normalizedSessionHistory) {
      for (const userId of normalizeParticipantIds(play?.participantIds, groupMemberIds)) {
        ids.add(userId);
      }
    }

    return [...ids];
  }, [groupMemberIds, sessionPlayRecord?.participantIds, normalizedSessionHistory]);

  useEffect(() => {
    let cancelled = false;

    async function loadKnownDirectoryProfiles() {
      const missingIds = knownParticipantIds.filter((userId) => {
        if (!userId) return false;
        if (memberById.has(userId)) return false;
        return !directoryProfilesById[userId];
      });

      if (missingIds.length === 0) return;

      const snaps = await Promise.all(
        missingIds.map((userId) => getDoc(doc(db, "userDirectory", userId)))
      );

      if (cancelled) return;

      setDirectoryProfilesById((prev) => {
        const next = { ...prev };
        snaps.forEach((snap, index) => {
          if (!snap.exists()) return;
          const data = snap.data() || {};
          const userId = String(data.userId || snap.id || missingIds[index] || "").trim();
          if (!userId) return;
          next[userId] = {
            userId,
            nickname: String(data.nickname || "").trim(),
            avatarId: isValidAvatarId(data.avatarId) ? data.avatarId : DEFAULT_AVATAR_ID,
          };
        });
        return next;
      });
    }

    loadKnownDirectoryProfiles().catch((err) => {
      console.warn("Failed to hydrate participant directory profiles:", err);
    });

    return () => {
      cancelled = true;
    };
  }, [knownParticipantIds, memberById, directoryProfilesById]);

  const participantSummaryById = useMemo(() => {
    const map = {};

    for (const userId of knownParticipantIds) {
      const member = memberById.get(userId);
      const directory = directoryProfilesById[userId] || null;
      const nickname = String(member?.nickname || directory?.nickname || "").trim();
      const avatarId = isValidAvatarId(memberProfilesById?.[userId]?.avatarId)
        ? memberProfilesById[userId].avatarId
        : isValidAvatarId(member?.avatarId)
        ? member.avatarId
        : isValidAvatarId(directory?.avatarId)
        ? directory.avatarId
        : DEFAULT_AVATAR_ID;

      map[userId] = {
        userId,
        nickname,
        label: nickname || truncateUserId(userId),
        avatarId,
        isMember: !!member,
      };
    }

    return map;
  }, [knownParticipantIds, memberById, directoryProfilesById, memberProfilesById]);

  const currentSessionParticipantIds = useMemo(() => {
    return normalizeParticipantIds(sessionPlayRecord?.participantIds, []);
  }, [sessionPlayRecord?.participantIds]);

  // --- Actions ---
  const showToast = useCallback((message, type = "info", title = "") => {
    const id =
      (typeof crypto !== "undefined" && crypto.randomUUID && crypto.randomUUID()) ||
      String(Date.now() + Math.random());

    setToasts((prev) => [...prev, { id, type, title, message }]);

    window.setTimeout(() => {
      setToasts((prev) => prev.filter((t) => t.id !== id));
    }, 3500);
  }, []);

  const closeToast = useCallback((id) => {
    setToasts((prev) => prev.filter((t) => t.id !== id));
  }, []);

  const goToSavedAccountSetup = useCallback((intent = "create") => {
    setSavedAccountRequiredOpen(false);
    setSelectedGame(null);
    setReturnCtx(null);
    setGroupView(GROUP_VIEW.PICKER);
    setActiveTab(APP_TAB.PROFILE);

    if (intent === "signin") {
      showToast("Sign in to a saved account to continue.", "info");
    } else {
      showToast("Create a saved account to continue.", "info");
    }
  }, [showToast]);

  const saveSessionPlay = useCallback(async ({ playedAt, playedGameIds, resultMode, placements, participantIds }) => {
    if (!user || !currentGroupId || !activeVote?.id || activeVote.status !== VOTE_STATUS.CLOSED) {
      return;
    }

    if (user.isAnonymous) {
      showToast("Saved account required for session history.", "info");
      setSavedAccountRequiredOpen(true);
      return;
    }

    if (!canManageSession) {
      showToast("Only the session owner (or group owner) can update session history.", "error");
      return;
    }

    const now = Date.now();
    const winnerGameId = activeVote?.winnerGameId || null;
    const normalizedResultMode = normalizeResultMode(
      resultMode,
      defaultResultMode(winnerGameId)
    );
    const normalizedParticipantIds = normalizeParticipantIds(
      participantIds,
      groupMemberIds
    );
    const normalizedPlayedGameIds = normalizePlayedGameIds(playedGameIds, winnerGameId);
    const normalizedPlacements = normalizeParticipantPlacements(
      placements,
      normalizedResultMode,
      normalizedParticipantIds
    );
    const playRef = doc(db, "groups", currentGroupId, "plays", activeVote.id);

    const payload = {
      groupId: currentGroupId,
      voteId: activeVote.id,
      sessionIndex:
        typeof sessionPlayRecord?.sessionIndex === "number"
          ? sessionPlayRecord.sessionIndex
          : null,
      playedAt: typeof playedAt === "number" ? playedAt : null,
      winnerGameId,
      playedGameIds: normalizedPlayedGameIds,
      participantIds: normalizedParticipantIds,
      resultMode: normalizedResultMode,
      placements: normalizedPlacements,
      createdAt:
        typeof sessionPlayRecord?.createdAt === "number"
          ? sessionPlayRecord.createdAt
          : now,
      updatedAt: now,
      createdBy: sessionPlayRecord?.createdBy || user.uid,
    };

    try {
      setIsSavingSessionPlay(true);
      await setDoc(playRef, payload, { merge: true });
      showToast("Session history saved ✅", "success");
    } catch (e) {
      console.error("saveSessionPlay failed:", e);
      showToast(e.code || e.message || "Failed to save session history.", "error");
    } finally {
      setIsSavingSessionPlay(false);
    }
  }, [
    user,
    currentGroupId,
    activeVote,
    canManageSession,
    groupMemberIds,
    sessionPlayRecord,
    showToast,
  ]);

  // Save an edit to a past session play record.
  // Preserves immutable fields (voteId, createdBy, createdAt, sessionIndex)
  // while allowing date, winner, additional games, result mode, and placements
  // to be updated.
  const savePastSessionPlay = useCallback(
    async (playRecord, { playedAt, winnerGameId, playedGameIds, resultMode, placements, participantIds }) => {
      if (!user || !currentGroupId || !playRecord?.id) return;

      if (user.isAnonymous) {
        showToast("Saved account required for session history.", "info");
        setSavedAccountRequiredOpen(true);
        return;
      }

      if (!canEditPastSession) {
        showToast("Only the group owner or a moderator can edit session history.", "error");
        return;
      }

      const now = Date.now();
      const effectiveWinnerId =
        typeof winnerGameId === "string" && winnerGameId.trim()
          ? winnerGameId.trim()
          : null;
      const normalizedResultMode = normalizeResultMode(
        resultMode,
        defaultResultMode(effectiveWinnerId)
      );
      const normalizedParticipantIds = normalizeParticipantIds(
        participantIds,
        groupMemberIds
      );
      const normalizedPlayedGameIds = normalizePlayedGameIds(
        playedGameIds,
        effectiveWinnerId
      );
      const normalizedPlacements = normalizeParticipantPlacements(
        placements,
        normalizedResultMode,
        normalizedParticipantIds
      );

      const playRef = doc(db, "groups", currentGroupId, "plays", playRecord.id);

      const payload = {
        groupId: currentGroupId,
        voteId: playRecord.voteId,
        sessionIndex:
          typeof playRecord.sessionIndex === "number" ? playRecord.sessionIndex : null,
        playedAt: typeof playedAt === "number" ? playedAt : null,
        winnerGameId: effectiveWinnerId,
        playedGameIds: normalizedPlayedGameIds,
        participantIds: normalizedParticipantIds,
        resultMode: normalizedResultMode,
        placements: normalizedPlacements,
        createdAt:
          typeof playRecord.createdAt === "number" ? playRecord.createdAt : now,
        updatedAt: now,
        createdBy: playRecord.createdBy || user.uid,
      };

      try {
        setIsSavingPastPlay(true);
        await setDoc(playRef, payload, { merge: true });
        showToast("Session updated ✅", "success");
        setEditingPastPlay(null);
      } catch (e) {
        console.error("savePastSessionPlay failed:", e);
        showToast(e.code || e.message || "Failed to update session.", "error");
      } finally {
        setIsSavingPastPlay(false);
      }
    },
    [user, currentGroupId, canEditPastSession, groupMemberIds, showToast]
  );

  function openEditGame(game) {
    setEditGameForm({
      id: game.id,
      title: game.title || "",
      description: game.description || "",
      imageUrl: game.imageUrl || "",
      tags: normalizeGameTags(game.tags),
    });
    setIsEditGameOpen(true);
  }

  function isValidImageUrl(url) {
    if (!url) return true; // optional field
    try {
      const u = new URL(url);
      return /\.(jpg|jpeg|png|webp|gif)$/i.test(u.pathname);
    } catch {
      return false;
    }
  }

  async function waitForServerDoc(ref, { timeoutMs = 2500, intervalMs = 150 } = {}) {
    const start = Date.now();
    while (Date.now() - start < timeoutMs) {
      try {
        const snap = await getDocFromServer(ref);
        if (snap.exists()) return snap;
      } catch {
        // if we’re offline or transient, just keep retrying until timeout
      }
      await new Promise((r) => setTimeout(r, intervalMs));
    }
    throw new Error("MEMBERSHIP_NOT_VISIBLE_YET");
  }

  async function saveNickname() {
    if (!user) return;
    const trimmed = nickname.trim();

    await updateDoc(doc(db, "users", user.uid), { nickname: trimmed });
    setProfile((p) => ({ ...(p || {}), nickname: trimmed }));
    setNickname(trimmed);
    await upsertMyUserDirectoryProfile({
      nickname: trimmed,
      avatarId: profile?.avatarId,
    });

    await syncMyNicknameToGroupMemberships(trimmed);
  }

  async function saveAvatarId(nextAvatarId) {
    if (!user) return;
    const avatarId = isValidAvatarId(nextAvatarId) ? nextAvatarId : DEFAULT_AVATAR_ID;

    await updateDoc(doc(db, "users", user.uid), { avatarId });
    setProfile((prev) => ({ ...(prev || {}), avatarId }));
    await upsertMyUserDirectoryProfile({
      nickname: profile?.nickname,
      avatarId,
    });
    await syncMyAvatarToGroupMemberships(avatarId);
  }

  function safeString(v) {
    if (v == null) return "";
    return String(v);
  }

  const upsertMyUserDirectoryProfile = useCallback(
    async ({ nickname: nextNickname, avatarId: nextAvatarId } = {}) => {
      if (!user?.uid) return;

      const normalizedNickname = String(nextNickname ?? "").trim();
      const normalizedAvatarId = isValidAvatarId(nextAvatarId)
        ? nextAvatarId
        : DEFAULT_AVATAR_ID;

      await setDoc(
        doc(db, "userDirectory", user.uid),
        {
          userId: user.uid,
          nickname: normalizedNickname,
          nicknameLower: normalizedNickname.toLowerCase(),
          avatarId: normalizedAvatarId,
          isAnonymous: !!user?.isAnonymous,
          updatedAt: Date.now(),
        },
        { merge: true }
      );

      setDirectoryProfilesById((prev) => ({
        ...prev,
        [user.uid]: {
          userId: user.uid,
          nickname: normalizedNickname,
          avatarId: normalizedAvatarId,
          isAnonymous: !!user?.isAnonymous,
        },
      }));
    },
    [user?.uid]
  );

  const searchSessionAccounts = useCallback(async (rawQuery) => {
    const requestedUserId = String(rawQuery || "").trim();
    if (!requestedUserId) return [];

    const exactSnap = await getDoc(doc(db, "userDirectory", requestedUserId));
    if (!exactSnap.exists()) return [];

    const data = exactSnap.data() || {};
    const userId = String(data.userId || exactSnap.id || "").trim();
    if (!userId) return [];

    const isAnonymousAccount = data?.isAnonymous === true;

    const results = [{
      userId,
      nickname: String(data.nickname || "").trim(),
      avatarId: isValidAvatarId(data.avatarId) ? data.avatarId : DEFAULT_AVATAR_ID,
      isAnonymous: isAnonymousAccount,
      isEligibleGuest: !isAnonymousAccount,
    }];

    if (results.length > 0) {
      setDirectoryProfilesById((prev) => {
        const next = { ...prev };
        for (const result of results) {
          next[result.userId] = {
            userId: result.userId,
            nickname: result.nickname,
            avatarId: result.avatarId,
            isAnonymous: result.isAnonymous === true,
          };
        }
        return next;
      });
    }

    return results;
  }, []);

  const syncMyCollectionToGroup = useCallback(async (groupId) => {
    if (!user) return;
  
    const gid = safeString(groupId).trim();
    if (!gid) return;
  
    // Prevent double-counting if someone clicks twice / calls twice
    const indexRef = doc(db, "users", user.uid, "groups", gid);
    const indexSnap = await getDoc(indexRef);
    const alreadySynced = indexSnap.exists() && !!indexSnap.data()?.syncedCollectionAt;
    if (alreadySynced) {
      showToast("Collection already synced for this group.", "info");
      return;
    }
  
    const myCollectionRef = collection(db, "users", user.uid, "collection");
    const snap = await getDocs(myCollectionRef);
  
    showToast(`Syncing ${snap.size} games into group…`, "info");
    if (snap.empty) {
      await setDoc(indexRef, { syncedCollectionAt: Date.now() }, { merge: true });
      return;
    }
  
    const batch = writeBatch(db);
    const now = Date.now();
  
    for (const d of snap.docs) {
      const gameId = safeString(d.data()?.gameId || d.id).trim();
      if (!gameId) continue;
  
      const ownerRef = doc(db, "groups", gid, "games", gameId, "owners", user.uid);
      const groupGameRef = doc(db, "groups", gid, "games", gameId);
  
      // idempotent owner marker
      batch.set(ownerRef, { addedAt: now }, { merge: true });
  
      // increment works even if field/doc doesn't exist yet
      batch.set(
        groupGameRef,
        { ownersCount: increment(1), updatedAt: now },
        { merge: true }
      );
    }
  
    await batch.commit();
  
    // Mark as synced to avoid double counting later
    await setDoc(indexRef, { syncedCollectionAt: now }, { merge: true });
  
    showToast("Group collection synced ✅", "success");
  }, [user, showToast]);
  
  const setMyGameSharedInGroup = useCallback(
    async (groupId, gameId, shouldShare) => {
      if (!user) return;

      if (user.isAnonymous) {
        showToast("Saved account required for group sharing.", "info");
        setSavedAccountRequiredOpen(true);
        return;
      }

      const gid = safeString(groupId).trim();
      const gmid = safeString(gameId).trim();
      if (!gid || !gmid) return;

      const ownerRef = doc(db, "groups", gid, "games", gmid, "owners", user.uid);
      const groupGameRef = doc(db, "groups", gid, "games", gmid);
      const now = Date.now();

      await runTransaction(db, async (tx) => {
        const ownerSnap = await tx.get(ownerRef);

        if (shouldShare) {
          if (!ownerSnap.exists()) {
            tx.set(ownerRef, { addedAt: now }, { merge: true });
            tx.set(groupGameRef, { ownersCount: increment(1), updatedAt: now }, { merge: true });
          } else {
            tx.set(ownerRef, { addedAt: ownerSnap.data()?.addedAt ?? now }, { merge: true });
          }
        } else {
          if (ownerSnap.exists()) {
            tx.delete(ownerRef);
            tx.set(groupGameRef, { ownersCount: increment(-1), updatedAt: now }, { merge: true });
          }
        }
      });

      // Optimistic local update
      setMySharedGameIdsInCurrentGroup((prev) => {
        const next = new Set(prev);
        if (shouldShare) next.add(gmid);
        else next.delete(gmid);
        return next;
      });

      showToast(shouldShare ? "Shared with group" : "Hidden from group", "success");
    },
    [user, showToast]
  );

  async function addGame(e) {
    e.preventDefault();

    const tags = normalizeGameTags(addGameForm.tags);

    if (!isValidImageUrl(addGameForm.imageUrl)) {
      showToast("Image URL must end with .jpg, .png, .webp, or .gif", "error");
      return;
    }

    if (!user) {
      showToast("Signing in… try again.", "info");
      return;
    }

    await addDoc(collection(db, "games"), {
      title: addGameForm.title.trim(),
      description: addGameForm.description.trim(),
      imageUrl: addGameForm.imageUrl.trim(),
      tags,
      createdBy: user.uid,
      ratingTotal: 0,
      ratingCount: 0,
      createdAt: Date.now(),
    });

    setAddGameForm({ title: "", description: "", imageUrl: "", tags: [] });
    setIsAddGameOpen(false);
  }

  async function addGameToAllMyGroups(gameId) {
    if (!user) return;

    const groupIds = myGroups.map((g) => g.id);
    if (groupIds.length === 0) return;

    // Use safe guarded operations to prevent double-counting
    // (matches setMyGameSharedInGroup pattern)
    const promises = groupIds.map((groupId) =>
      safeAddGameToGroup(groupId, gameId)
    );

    await Promise.all(promises);
  }

  async function removeGameFromAllMyGroups(gameId) {
    if (!user) return;

    const groupIds = myGroups.map((g) => g.id);
    if (groupIds.length === 0) return;

    // Use safe guarded operations to prevent negative counts
    // (matches setMyGameSharedInGroup pattern)
    const promises = groupIds.map((groupId) =>
      safeRemoveGameFromGroup(groupId, gameId)
    );

    await Promise.all(promises);
  }

  async function addToCollection(gameId) {
    if (!user) return;

    await setDoc(doc(db, "users", user.uid, "collection", gameId), {
      gameId,                 // ✅ make it explicit
      addedAt: Date.now(),
    });

    await addGameToAllMyGroups(gameId);
  }

  async function removeFromCollection(gameId) {
    if (!user) return;

    await deleteDoc(doc(db, "users", user.uid, "collection", gameId));

    await removeGameFromAllMyGroups(gameId);
  }

  // Safe guarded add: only increments ownersCount if owner marker doesn't exist
  // Prevents double-counting from rapid calls, races, or re-syncs
  async function safeAddGameToGroup(groupId, gameId) {
    if (!user) return;

    const ownerRef = doc(db, "groups", groupId, "games", gameId, "owners", user.uid);
    const groupGameRef = doc(db, "groups", groupId, "games", gameId);
    const now = Date.now();

    await runTransaction(db, async (tx) => {
      const ownerSnap = await tx.get(ownerRef);

      if (!ownerSnap.exists()) {
        // New owner - create marker and increment count
        tx.set(ownerRef, { addedAt: now });
        tx.set(groupGameRef, { ownersCount: increment(1), updatedAt: now }, { merge: true });
      }
      // If owner already exists, no-op (idempotent)
    });
  }

  // Safe guarded remove: only decrements ownersCount if owner marker exists
  // Prevents negative counts from missing markers or double-deletes
  async function safeRemoveGameFromGroup(groupId, gameId) {
    if (!user) return;

    const ownerRef = doc(db, "groups", groupId, "games", gameId, "owners", user.uid);
    const groupGameRef = doc(db, "groups", groupId, "games", gameId);
    const now = Date.now();

    await runTransaction(db, async (tx) => {
      const ownerSnap = await tx.get(ownerRef);

      if (ownerSnap.exists()) {
        // Owner exists - delete marker and decrement count
        tx.delete(ownerRef);
        tx.set(groupGameRef, { ownersCount: increment(-1), updatedAt: now }, { merge: true });
      }
      // If owner doesn't exist, no-op (idempotent)
    });
  }

  async function rateGame(gameId, value) {
    if (!user) return;

    if (user.isAnonymous) {
      showToast("Create a saved account to rate games.", "info");
      return;
    }

    // enforce 0.5 steps + range on client; 0 means clear/remove rating
    const v = Math.round(Number(value) * 2) / 2;
    if (!Number.isFinite(v) || v < 0 || v > 5) return;

    const ratingRef = doc(db, "ratings", `${user.uid}_${gameId}`);
    const gameRef = doc(db, "games", gameId);

    await runTransaction(db, async (tx) => {
      const [ratingSnap, gameSnap] = await Promise.all([
        tx.get(ratingRef),
        tx.get(gameRef),
      ]);

      if (!gameSnap.exists()) throw new Error("Game does not exist.");

      const game = gameSnap.data();
      const ratingTotal = Number(game.ratingTotal || 0);
      const ratingCount = Number(game.ratingCount || 0);

      if (!ratingSnap.exists()) {
        if (v === 0) return;

        // first time rating
        tx.set(ratingRef, {
          userId: user.uid,
          gameId,
          value: v,
          updatedAt: Date.now(),
        });

        tx.update(gameRef, {
          ratingTotal: ratingTotal + v,
          ratingCount: ratingCount + 1,
        });

        return;
      }

      // update existing rating
      const old = Number(ratingSnap.data().value || 0);

      if (v === 0) {
        tx.delete(ratingRef);
        tx.update(gameRef, {
          ratingTotal: ratingTotal - old,
          ratingCount: Math.max(0, ratingCount - 1),
        });
        return;
      }

      const delta = v - old;

      // no-op if unchanged
      if (delta === 0) return;

      tx.update(ratingRef, { value: v, updatedAt: Date.now() });
      tx.update(gameRef, { ratingTotal: ratingTotal + delta });
    });
  }

  async function saveEditedGame(e) {
    e.preventDefault();
    if (!user || !editGameForm.id) return;

    const tags = normalizeGameTags(editGameForm.tags);

    try {
      await updateDoc(doc(db, "games", editGameForm.id), {
        title: editGameForm.title.trim(),
        description: editGameForm.description.trim(),
        imageUrl: editGameForm.imageUrl.trim(),
        tags,
        updatedAt: Date.now(),
      });
      showToast("Game updated ✅", "success");
      setIsEditGameOpen(false);
    } catch (err) {
      console.error("saveEditedGame failed:", err);
      showToast(err.code || "Failed to update game.", "error");
    }
  }

  async function deleteGame(gameId) {
    if (!user || !gameId) return;

    const ok = window.confirm(
      "Delete this game? This cannot be undone and will remove it from your groups."
    );
    if (!ok) return;

    try {
      setIsDeletingGame(true);

      // IMPORTANT: require the main delete to succeed.
      // If rules deny this (e.g., game owned by someone else), we should NOT show success.
      await deleteDoc(doc(db, "games", gameId));

      // Best-effort cleanup (Firestore deletes are idempotent)
      const ops = [];

      // Remove from my personal collection + my rating doc (if they exist)
      ops.push(deleteDoc(doc(db, "users", user.uid, "collection", gameId)));
      ops.push(deleteDoc(doc(db, "ratings", `${user.uid}_${gameId}`)));

      // Remove from each group I belong to (removes it from that group's pool for everyone)
      for (const g of myGroups) {
        ops.push(deleteDoc(doc(db, "groups", g.id, "games", gameId)));
      }

      await Promise.allSettled(ops);

      showToast("Game deleted 🗑️", "success");
      setIsEditGameOpen(false);
      setSelectedGame(null);
    } catch (err) {
      console.error("deleteGame failed:", err);
      showToast(err.code || "Failed to delete game.", "error");
    } finally {
      setIsDeletingGame(false);
    }
  }

  // Bootstraps group settings doc so toggles/rules have a stable default.
// Safe to call multiple times (merge=true).
  async function bootstrapGroupMeta(groupId) {
    if (!user) return;

    const ref = doc(db, "groups", groupId, "settings", "meta");
    await setDoc(
      ref,
      {
        // Feature flags (defaults)
        moderatorsCanEditWeights: false,
        disallowVotingOwnSubmission: false,

        // Optional: future flags you mentioned
        // includeGamesByDefault: true,

        // auto-advance flags (defaults off)
        autoAdvanceWhenAllSubmitted: false,
        autoAdvanceWhenAllVoted: false,
        hiddenTags: [],

        createdAt: Date.now(),
        createdBy: user.uid,
      },
      { merge: true }
    );
  }

  async function createGroup(name) {
    if (!user) {
      showToast("Signing in… try again in a second.", "info");
      return null;
    }

    if (user.isAnonymous) {
      showToast("Saved account required for groups and sessions.", "info");
      setSavedAccountRequiredOpen(true);
      return null;
    }
  
    const groupName = safeString(name).trim();
    if (!groupName) {
      showToast("Group name cannot be empty.", "error");
      return null;
    }
  
    const existing = myGroups.some(
      (g) => safeString(g.name).trim().toLowerCase() === groupName.toLowerCase()
    );
    if (existing) {
      showToast("You already have a group with that name.", "error");
      return null;
    }
  
    try {
      const groupRef = await addDoc(collection(db, "groups"), {
        name: groupName,
        ownerId: user.uid,
        createdAt: Date.now(),
      });
  
      await setDoc(doc(db, "groups", groupRef.id, "members", user.uid), {
        role: "owner",
        joinedAt: Date.now(),
        nickname: safeString(profile?.nickname),
        avatarId: isValidAvatarId(profile?.avatarId) ? profile.avatarId : DEFAULT_AVATAR_ID,
      });
  
      await setDoc(doc(db, "users", user.uid, "groups", groupRef.id), {
        joinedAt: Date.now(),
        syncedCollectionAt: null,
      });

      await bootstrapGroupMeta(groupRef.id);
  
      try {
        await syncMyCollectionToGroup(groupRef.id);
      } catch (e) {
        console.error("syncMyCollectionToGroup failed (non-fatal):", e);
        showToast("Group created, but collection sync failed.", "info");
      }
  
      showToast("Group created ✅", "success");
      return groupRef.id;
    } catch (e) {
      console.error("createGroup failed:", e);
      showToast(e.code || e.message || "Failed to create group.", "error");
      return null;
    }
  }

  async function joinGroup(groupId) {
    if (!user) {
      showToast("Signing in… try again in a second.", "info");
      return false;
    }

    if (user.isAnonymous) {
      showToast("Saved account required for groups and sessions.", "info");
      setSavedAccountRequiredOpen(true);
      return false;
    }

    const id = groupId.trim();
    if (!id) {
      showToast("Paste an invite code first.", "error");
      return false;
    }

    try {
      const groupRef = doc(db, "groups", id);
      const memberRef = doc(db, "groups", id, "members", user.uid);

      const [gSnap, mSnap] = await Promise.all([
        getDoc(groupRef),
        getDoc(memberRef),
      ]);

      if (!gSnap.exists()) {
        showToast("Group not found. Check the invite code.", "error");
        return false;
      }

      if (mSnap.exists()) {
        showToast("You’re already a member of this group.", "info");
        return true;
      }

      await setDoc(memberRef, {
        role: "member",
        joinedAt: Date.now(),
        nickname: profile?.nickname || "",
        avatarId: isValidAvatarId(profile?.avatarId) ? profile.avatarId : DEFAULT_AVATAR_ID,
      });

      await waitForServerDoc(memberRef);

      await setDoc(doc(db, "users", user.uid, "groups", id), {
        joinedAt: Date.now(),
        syncedCollectionAt: null,
      }, { merge: true });

      // await bootstrapGroupMeta(groupRef.id);

      try {
        await syncMyCollectionToGroup(id);
      } catch (e) {
        console.error("syncMyCollectionToGroup failed after join:", e);
        showToast("Joined, but collection sync failed.", "info");
      }

      showToast("Joined group ✅", "success");
      return true;
    } catch (e) {
      console.error("joinGroup failed:", e);
      showToast(e.code || "Failed to join group.", "error");
      return false;
    }
  }

  async function leaveGroup(groupId) {
    if (!user) {
      showToast("Signing in… try again in a second.", "info");
      return false;
    }

    const gid = groupId?.trim();
    if (!gid) return false;

    try {
      // Step 1: load group + members (outside tx)
      const groupRef = doc(db, "groups", gid);
      const groupSnap = await getDoc(groupRef);
      if (!groupSnap.exists()) {
        showToast("Group not found.", "error");
        return false;
      }

      const group = groupSnap.data();
      const ownerId = group.ownerId;

      const membersSnap = await getDoc(doc(db, "groups", gid, "members", user.uid));
      if (!membersSnap.exists()) {
        showToast("You are not a member of this group.", "error");
        return false;
      }

      const allMembers = await getDocs(collection(db, "groups", gid, "members"));
      const memberIds = allMembers.docs.map((d) => d.id);

      // compute remaining members after leaving
      const remaining = memberIds.filter((id) => id !== user.uid);

      // Choose next owner if needed
      const nextOwnerId = ownerId === user.uid ? (remaining[0] || null) : ownerId;

      await runTransaction(db, async (tx) => {
        const myMemberRef = doc(db, "groups", gid, "members", user.uid);
        const myIndexRef = doc(db, "users", user.uid, "groups", gid);

        // delete membership + index
        tx.delete(myMemberRef);
        tx.delete(myIndexRef);

        // owner leaving cases
        if (ownerId === user.uid) {
          if (nextOwnerId) {
            tx.update(groupRef, { ownerId: nextOwnerId });
          } else {
            // no members left -> delete group
            tx.delete(groupRef);
          }
        }
      });

      // UI state updates
      if (currentGroupId === gid) {
        setCurrentGroupId("");
              setGroupView(GROUP_VIEW.PICKER);
      }

      showToast("Left group.", "success");
      return true;
    } catch (e) {
      console.error("leaveGroup failed:", e);
      showToast(e.code || e.message || "Failed to leave group.", "error");
      return false;
    }
  }

  async function saveGroupMeta(patch) {
    if (!user || !currentGroupId) return;
    if (currentGroup?.ownerId !== user.uid) {
      showToast("Only the owner can edit group rules.", "error");
      return;
    }

    const normalizedPatch = {
      ...patch,
      hiddenTags: normalizeGameTags(patch?.hiddenTags),
    };

    await setDoc(doc(db, "groups", currentGroupId, "settings", "meta"), normalizedPatch, { merge: true });
    showToast("Group rules saved.", "success");
  }

  async function togglePlayedOverride(gameId, playedOverride) {
    if (!user || !currentGroupId) return;

    if (user.isAnonymous) {
      showToast("Saved account required for group session features.", "info");
      setSavedAccountRequiredOpen(true);
      return;
    }
  
    if (currentGroup?.ownerId !== user.uid) {
      showToast("Only the group owner can change this.", "error");
      return;
    }
  
    const ref = doc(db, "groups", currentGroupId, "pool", gameId);
  
    try {
      await setDoc(ref, { playedOverride: !!playedOverride }, { merge: true });
  
      // ✅ Force a server read to confirm it actually landed.
      const serverSnap = await getDocFromServer(ref);
  
      if (!serverSnap.exists()) {
        showToast(
          "Saved locally, but not synced to server yet (offline/blocked).",
          "error"
        );
        return;
      }
  
      showToast("Updated ✅", "success");
    } catch (e) {
      console.error("togglePlayedOverride failed:", e);
      showToast(e.code || e.message || "Failed to update.", "error");
    }
  }

  async function castVote(gameId) {
    if (!user || !currentGroupId || !activeVote?.id || !activeVote) return;
    if (user.isAnonymous) {
      showToast("Saved account required for voting.", "info");
      setSavedAccountRequiredOpen(true);
      return;
    }
    if (activeVote.status !== VOTE_STATUS.OPEN) return;

    const candidates = activeVote.candidates || [];
    if (!candidates.includes(gameId)) {
      showToast("That game is not in this session’s candidates.", "error");
      return;
    }

    await setDoc(
      doc(db, "groups", currentGroupId, "votes", activeVote?.id, "ballots", user.uid),
      { gameId, submittedAt: Date.now() }
    );

    showToast("Vote submitted ✅", "success");
  }

  const closeVote = useCallback(async (opts = {}) => {
    if (!user || !currentGroupId || !activeVote?.id || !activeVote) return;
    if (user.isAnonymous) {
      showToast("Saved account required for voting.", "info");
      setSavedAccountRequiredOpen(true);
      return;
    }
    if (activeVote.status !== VOTE_STATUS.OPEN) return;

    // ✅ only block manual calls; allow auto calls
    if (!opts.auto && !canCloseActiveVote) {
      showToast("Only the session owner (or group owner) can close.", "error");
      return;
    }

    try {
      const now = Date.now();

      // 1) Tally ballots
      const ballotsSnap = await getDocs(
        collection(db, "groups", currentGroupId, "votes", activeVote.id, "ballots")
      );

      const voteCounts = new Map(); // gameId -> votes
      ballotsSnap.forEach((d) => {
        const { gameId } = d.data();
        if (!gameId) return;
        voteCounts.set(gameId, (voteCounts.get(gameId) || 0) + 1);
      });

      // 2) Build pool map for weighting inputs
      const poolMap = new Map(poolDocs.map((p) => [p.id, p]));

      // 3) Pick winner (only voted games eligible)
      const winnerResult = pickWeightedWinner({
        voteCounts,
        poolMap,
        now,
        sessionIndex,
        weights: effectiveWeights,
      });

      if (!winnerResult) {
        throw new Error("WINNER_SELECTION_FAILED");
      }

      const { winnerGameId, scoreBreakdown, weightsUsed } = winnerResult;

      const normalizeScoreRow = (r) => {
      const votes = Number(r.sessionVotes ?? r.votes ?? r.voteCount ?? 0);
      const score = Number(
        r.score ??
        r.effectiveScore ??
        r.finalScore ??
        r.weightedScore ??
        r.totalScore ??
        r.points ??
        0
      );

        return {
          ...r,
          sessionVotes: votes,
          score,
        };
      };

      const normalizedBreakdown = Array.isArray(scoreBreakdown)
        ? scoreBreakdown.map(normalizeScoreRow)
        : [];

      const voteRef = doc(db, "groups", currentGroupId, "votes", activeVote.id);
      const batch = writeBatch(db);

      // Close vote + store debug info
      batch.update(voteRef, {
        status: VOTE_STATUS.CLOSED,
        closedAt: now,
        winnerGameId,
        scoreBreakdown: normalizedBreakdown,
        weightsUsed,
      });

      // Update pool stats ONLY for games that got votes (>0)
      for (const { gameId, sessionVotes } of normalizedBreakdown) {
        const poolRef = doc(db, "groups", currentGroupId, "pool", gameId);
        batch.set(
          poolRef,
          {
            lastVotedAt: now,
            cycleVoteCount: increment(sessionVotes),
            lifetimeVoteCount: increment(sessionVotes),
          },
          { merge: true }
        );
      }

      // Winner leaves pool
      if (winnerGameId) {
        const winnerPoolRef = doc(db, "groups", currentGroupId, "pool", winnerGameId);

        batch.set(
          winnerPoolRef,
          {
            isActive: false,
            lastWonAt: now,              // optional
            lastWonSession: sessionIndex,
            playedCount: increment(1),
            lastPlayedAt: now,           // optional
          },
          { merge: true }
        );
      }

      // Upsert session history/play record for this vote
      const playRef = doc(db, "groups", currentGroupId, "plays", activeVote.id);
      batch.set(
        playRef,
        {
          groupId: currentGroupId,
          voteId: activeVote.id,
          sessionIndex,
          playedAt: now,
          winnerGameId: winnerGameId || null,
          playedGameIds: normalizePlayedGameIds([], winnerGameId),
          participantIds: normalizeParticipantIds([], groupMemberIds),
          resultMode: defaultResultMode(winnerGameId),
          placements: [],
          createdAt: now,
          updatedAt: now,
          createdBy: user.uid,
        },
        { merge: true }
      );

      await batch.commit();

      // Clear active session meta so a new session can start
      await updateDoc(doc(db, "groups", currentGroupId, "activeSession", "meta"), {
        status: null,
        activeVoteId: null,
        sessionIndex: increment(1),
        updatedAt: now,
      });

      setWinnerModal({
        winnerGameId,
        scoreBreakdown: normalizedBreakdown,
        weightsUsed,
      });

      showToast(
        winnerGameId ? "Vote closed 🎉 Winner selected." : "Vote closed (no votes cast).",
        winnerGameId ? "success" : "info"
      );
    } catch (e) {
      console.error("closeVote failed:", e);
      if (!opts.auto) {
        showToast(e.code || e.message || "Failed to close vote.", "error");
      }
    }
  }, [
    user,
    currentGroupId,
    activeVote,
    canCloseActiveVote,
    poolDocs,
    effectiveWeights,
    groupMemberIds,
    sessionIndex,
    showToast,
  ]);

  async function callSession() {
    if (!user || !currentGroupId) return;

    if (user.isAnonymous) {
      showToast("Saved account required for sessions.", "info");
      setSavedAccountRequiredOpen(true);
      return;
    }

    if (activeVote && (activeVote.status === VOTE_STATUS.COLLECTING || activeVote.status === VOTE_STATUS.OPEN)) {
      showToast("A session is already active.", "info");
      return;
    }

    const now = Date.now();

    const voteRef = await addDoc(collection(db, "groups", currentGroupId, "votes"), {
      status: VOTE_STATUS.COLLECTING,
      createdAt: now,
      createdBy: user.uid,
    });

    // Create or update meta (sessionIndex persists)
    const metaRef = doc(db, "groups", currentGroupId, "activeSession", "meta");
    const currentIndex = Number(sessionMeta?.sessionIndex || 0);

    await setDoc(
      metaRef,
      {
        activeVoteId: voteRef.id,
        ownerId: user.uid,
        status: VOTE_STATUS.COLLECTING,
        sessionIndex: currentIndex,
        updatedAt: now,
      },
      { merge: true }
    );

    showToast("Session started. Collecting submissions…", "success");
  }

  async function submitToSession(gameId) {
    if (!user || !currentGroupId || !activeVote?.id) return;

    if (user.isAnonymous) {
      showToast("Saved account required for sessions.", "info");
      setSavedAccountRequiredOpen(true);
      return;
    }

    const gid = String(gameId || "").trim();
    if (!gid) {
      showToast("Pick a game first.", "error");
      return;
    }

    if (activeVote.status !== VOTE_STATUS.COLLECTING) {
      showToast("Submissions are closed.", "error");
      return;
    }

    const now = Date.now();

    const submissionRef = doc(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVote.id,
      "submissions",
      user.uid
    );

    const poolRef = doc(db, "groups", currentGroupId, "pool", gid);

    const voteRef = doc(db, "groups", currentGroupId, "votes", activeVote.id);
    const metaRef = doc(db, "groups", currentGroupId, "activeSession", "meta");

    let oldGameIdToReconcile = null;

    try {
      await runTransaction(db, async (tx) => {
        const [voteSnap, metaSnap, subSnap, poolSnap] = await Promise.all([
          tx.get(voteRef),
          tx.get(metaRef),
          tx.get(submissionRef),
          tx.get(poolRef),
        ]);

        // Must be collecting (server truth)
        const voteStatus = voteSnap.exists() ? voteSnap.data()?.status : null;
        if (voteStatus !== VOTE_STATUS.COLLECTING) {
          throw new Error("NOT_COLLECTING");
        }

        const metaStatus = metaSnap.exists() ? metaSnap.data()?.status : null;
        if (metaStatus && metaStatus !== VOTE_STATUS.COLLECTING) {
          throw new Error("NOT_COLLECTING");
        }

        // During COLLECTING, user can change their submission
        // Get current submission if any
        const currentSubmission = subSnap.exists() ? subSnap.data() : null;
        const currentGameId = currentSubmission?.gameId || null;

        // Don't allow selecting a game already active in pool
        // UNLESS it's the same game the user already submitted (allows no-op resubmit)
        const poolData = poolSnap.exists() ? (poolSnap.data() || {}) : null;
        if (poolData?.isActive === true && gid !== currentGameId) {
          throw new Error("ALREADY_IN_POOL");
        }

        const transactionSessionIndex = metaSnap.exists()
          ? Number(metaSnap.data()?.sessionIndex || 0)
          : 0;

        // Write submission
        tx.set(submissionRef, { gameId: gid, submittedAt: now }, { merge: false });

        // Activate / repair pool doc for new game
        const needsAddedAt = !poolSnap.exists() || poolData?.addedAt == null;

        tx.set(
          poolRef,
          {
            isActive: true,
            cycleStartedAt: now,
            cycleVoteCount: 0,
            cycleStartedSession: transactionSessionIndex,
            ...(needsAddedAt ? { addedAt: now } : {}),
          },
          { merge: true }
        );

        // Store old game ID for post-transaction reconciliation
        if (currentGameId && currentGameId !== gid) {
          oldGameIdToReconcile = currentGameId;
        }
      });

      // After transaction commits, reconcile old game pool status
      if (oldGameIdToReconcile) {
        try {
          const allSubmissionsSnap = await getDocs(
            collection(db, "groups", currentGroupId, "votes", activeVote.id, "submissions")
          );

          const otherStillReferencesOldGame = allSubmissionsSnap.docs.some((doc) => {
            // Skip current user's submission (we just changed it)
            if (doc.id === user.uid) return false;
            const data = doc.data();
            return data?.gameId === oldGameIdToReconcile;
          });

          // If no other submission references the old game, deactivate it
          if (!otherStillReferencesOldGame) {
            const oldPoolRef = doc(db, "groups", currentGroupId, "pool", oldGameIdToReconcile);
            await updateDoc(oldPoolRef, { isActive: false });
          }
        } catch (reconcileError) {
          // Log but don't fail the whole operation - reconciliation is best-effort cleanup
          console.warn("Pool reconciliation failed (non-critical):", reconcileError);
        }
      }

      showToast("Game submitted ✅", "success");
    } catch (e) {
      console.error("submitToSession failed:", e);

      // Friendly messages for our intentional throws
      const msg =
        e?.message === "ALREADY_IN_POOL"
          ? "That game is already active in the pool."
          : e?.message === "NOT_COLLECTING"
          ? "Submissions are closed."
          : e?.code === "permission-denied"
          ? "Missing or insufficient permissions."
          : e?.message || "Failed to submit game.";

      showToast(msg, "error");
    }
  }

  async function submitNoSubmission() {
    if (!user || !currentGroupId || !activeVote?.id) return;

    if (user.isAnonymous) {
      showToast("Saved account required for sessions.", "info");
      setSavedAccountRequiredOpen(true);
      return;
    }

    if (activeVote.status !== VOTE_STATUS.COLLECTING) {
      showToast("Submissions are closed.", "error");
      return;
    }

    const now = Date.now();

    const submissionRef = doc(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVote.id,
      "submissions",
      user.uid
    );

    const voteRef = doc(db, "groups", currentGroupId, "votes", activeVote.id);
    const metaRef = doc(db, "groups", currentGroupId, "activeSession", "meta");

    let oldGameIdToReconcile = null;

    try {
      await runTransaction(db, async (tx) => {
        const [voteSnap, metaSnap, subSnap] = await Promise.all([
          tx.get(voteRef),
          tx.get(metaRef),
          tx.get(submissionRef),
        ]);

        // Must be collecting (server truth)
        const voteStatus = voteSnap.exists() ? voteSnap.data()?.status : null;
        if (voteStatus !== VOTE_STATUS.COLLECTING) {
          throw new Error("NOT_COLLECTING");
        }

        const metaStatus = metaSnap.exists() ? metaSnap.data()?.status : null;
        if (metaStatus && metaStatus !== VOTE_STATUS.COLLECTING) {
          throw new Error("NOT_COLLECTING");
        }

        // Get current submission to check if we need to deactivate an old game
        const currentSubmission = subSnap.exists() ? subSnap.data() : null;
        const currentGameId = currentSubmission?.gameId || null;

        // Write no-submission marker (overwrites previous submission if any)
        tx.set(
          submissionRef,
          { isNoSubmission: true, submittedAt: now },
          { merge: false }
        );

        // Store old game ID for post-transaction reconciliation
        if (currentGameId) {
          oldGameIdToReconcile = currentGameId;
        }
      });

      // After transaction commits, reconcile old game pool status
      if (oldGameIdToReconcile) {
        try {
          const allSubmissionsSnap = await getDocs(
            collection(db, "groups", currentGroupId, "votes", activeVote.id, "submissions")
          );

          const otherStillReferencesOldGame = allSubmissionsSnap.docs.some((doc) => {
            // Skip current user's submission (we just changed it)
            if (doc.id === user.uid) return false;
            const data = doc.data();
            return data?.gameId === oldGameIdToReconcile;
          });

          // If no other submission references the old game, deactivate it
          if (!otherStillReferencesOldGame) {
            const oldPoolRef = doc(db, "groups", currentGroupId, "pool", oldGameIdToReconcile);
            await updateDoc(oldPoolRef, { isActive: false });
          }
        } catch (reconcileError) {
          // Log but don't fail the whole operation - reconciliation is best-effort cleanup
          console.warn("Pool reconciliation failed (non-critical):", reconcileError);
        }
      }

      showToast("Marked as no submission ✓", "success");
    } catch (e) {
      console.error("submitNoSubmission failed:", e);

      const msg =
        e?.message === "NOT_COLLECTING"
          ? "Submissions are closed."
          : e?.code === "permission-denied"
          ? "Missing or insufficient permissions."
          : e?.message || "Failed to mark no submission.";

      showToast(msg, "error");
    }
  }

  const startVoting = useCallback(
    async ({ allowMember = false, silent = false } = {}) => {
      if (!user || !currentGroupId || !activeVote?.id || !activeVote) return;
      if (user.isAnonymous) {
        if (!silent) showToast("Saved account required for voting.", "info");
        setSavedAccountRequiredOpen(true);
        return;
      }
      if (activeVote.status !== VOTE_STATUS.COLLECTING) return;

      const isVoteOwner = activeVote.createdBy === user.uid;
      const isGroupOwner = currentGroup?.ownerId === user.uid;

      // UI still blocks, but auto-advance can bypass
      if (!allowMember && !isVoteOwner && !isGroupOwner) {
        if (!silent) showToast("Only the session owner can start voting.", "error");
        return;
      }

      const subsSnap = await getDocs(
        collection(db, "groups", currentGroupId, "votes", activeVote.id, "submissions")
      );

      const submittedIds = subsSnap.docs.map((d) => d.data().gameId).filter(Boolean);
      const candidates = Array.from(new Set([...activePoolGameIds, ...submittedIds]));

      if (candidates.length === 0) {
        if (!silent) showToast("Cannot start voting: no games in pool or submitted.", "error");
        return;
      }

      await updateDoc(doc(db, "groups", currentGroupId, "votes", activeVote.id), {
        status: VOTE_STATUS.OPEN,
        openedAt: Date.now(),
        candidates,
      });

      await updateDoc(doc(db, "groups", currentGroupId, "activeSession", "meta"), {
        status: VOTE_STATUS.OPEN,
        updatedAt: Date.now(),
      });

      if (!silent) showToast("Voting is open 🎲", "success");
    },
    [user, currentGroupId, activeVote, currentGroup, activePoolGameIds, showToast]
  );

  // ✅ Auto: collecting -> open when everyone submitted
  useEffect(() => {
    if (!currentGroupId) return;
    if (!activeVote?.id) return;

    // must be collecting
    if (activeVote.status !== VOTE_STATUS.COLLECTING) return;

    // feature flag must be enabled
    if (groupSettings?.autoAdvanceWhenAllSubmitted !== true) return;

    // need a stable member count
    if (!groupMemberCount || groupMemberCount <= 0) return;

    // prevent repeated firing for same vote
    if (autoStartRef.current.voteId === activeVote.id) return;

    if (submissionsCount >= groupMemberCount) {
      autoStartRef.current.voteId = activeVote.id;
      // call the same function the button calls
      startVoting({ allowMember: true, silent: true }).catch((e) => {
        console.error("Auto startVoting failed:", e);
        autoStartRef.current.voteId = null;
      });
    }
  }, [
    currentGroupId,
    activeVote?.id,
    activeVote?.status,
    groupSettings?.autoAdvanceWhenAllSubmitted,
    submissionsCount,
    groupMemberCount,
    startVoting,
  ]);

  // ✅ Auto: open -> closed when everyone voted
  useEffect(() => {
    if (!currentGroupId) return;
    if (!activeVote?.id) return;

    // must be open
    if (activeVote.status !== VOTE_STATUS.OPEN) return;

    // feature flag must be enabled
    if (groupSettings?.autoAdvanceWhenAllVoted !== true) return;

    if (!groupMemberCount || groupMemberCount <= 0) return;

    if (autoCloseRef.current.voteId === activeVote.id) return;

    if (ballotsCount >= groupMemberCount) {
      autoCloseRef.current.voteId = activeVote.id;
      closeVote({ auto: true }).catch((e) => {
        console.error("Auto closeVote failed:", e);
        autoCloseRef.current.voteId = null;
      });
    }
  }, [
    currentGroupId,
    activeVote?.id,
    activeVote?.status,
    groupSettings?.autoAdvanceWhenAllVoted,
    ballotsCount,
    groupMemberCount,
    closeVote,
  ]);

  async function saveGroupWeights(overrides) {
    if (!user || !currentGroupId) return;

    if (!canEditWeights) {
      showToast("Only the owner (or a moderator) can edit weights.", "error");
      return;
    }

    try {
      await setDoc(
        doc(db, "groups", currentGroupId, "settings", "weights"),
        overrides,
        { merge: false }
      );
      showToast("Weight settings saved.", "success");
    } catch (e) {
      console.error("saveGroupWeights failed:", e);
      showToast(e.code || e.message || "Failed to save settings.", "error");
    }
  }

  async function resetGroupWeightsInFirestore() {
    if (!user || !currentGroupId) return;

    if (!canEditWeights) {
      showToast("Only the owner (or a moderator) can edit weights.", "error");
      return;
    }

    try {
      await deleteDoc(doc(db, "groups", currentGroupId, "settings", "weights"));
      showToast("Weight overrides cleared.", "success");
    } catch (e) {
      console.error("resetGroupWeightsInFirestore failed:", e);
      showToast(e.code || e.message || "Failed to clear overrides.", "error");
    }
  }

  async function transferGroupOwnership(groupId, newOwnerUid) {
    if (!user) return;

    const groupRef = doc(db, "groups", groupId);
    const oldOwnerUid = currentGroup?.ownerId;

    await runTransaction(db, async (tx) => {
      const g = await tx.get(groupRef);
      if (!g.exists()) throw new Error("Group missing");
      if (g.data().ownerId !== user.uid) throw new Error("Not owner");

      // update group owner
      tx.update(groupRef, { ownerId: newOwnerUid });

      // swap roles
      tx.update(doc(db, "groups", groupId, "members", newOwnerUid), { role: "owner" });
      if (oldOwnerUid && oldOwnerUid !== newOwnerUid) {
        tx.update(doc(db, "groups", groupId, "members", oldOwnerUid), { role: "member" });
      }
    });
  }

  async function setMemberRole(groupId, memberUid, role) {
    if (!user) return;
    await updateDoc(doc(db, "groups", groupId, "members", memberUid), { role });
  }

  // ---- Expot Data -----
  async function buildSessionExportPayload(voteId) {
    const voteRef = doc(db, "groups", currentGroupId, "votes", voteId);
    const voteSnap = await getDoc(voteRef);
    if (!voteSnap.exists()) throw new Error("Vote not found.");

    const vote = { id: voteSnap.id, ...voteSnap.data() };

    const [ballotsSnap, submissionsSnap] = await Promise.all([
      getDocs(collection(db, "groups", currentGroupId, "votes", voteId, "ballots")),
      getDocs(collection(db, "groups", currentGroupId, "votes", voteId, "submissions")),
    ]);

    const ballots = ballotsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));
    const submissions = submissionsSnap.docs.map((d) => ({ id: d.id, ...d.data() }));

    const metaSnap = await getDoc(doc(db, "groups", currentGroupId, "activeSession", "meta"));
    const sessionMetaExport = metaSnap.exists() ? { id: metaSnap.id, ...metaSnap.data() } : null;

    const candidateIds =
      Array.isArray(vote.candidates) && vote.candidates.length > 0
        ? vote.candidates
        : Array.from(new Set(ballots.map((b) => b.gameId).filter(Boolean)));

    const poolSnaps = await Promise.all(
      candidateIds.map((gid) => getDoc(doc(db, "groups", currentGroupId, "pool", gid)))
    );
    const poolSnapshot = poolSnaps
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, ...s.data() }));

    const gameSnaps = await Promise.all(candidateIds.map((gid) => getDoc(doc(db, "games", gid))));
    const gamesSnapshot = gameSnaps
      .filter((s) => s.exists())
      .map((s) => ({ id: s.id, ...s.data() }));

    return {
      exportedAt: Date.now(),
      groupId: currentGroupId,
      vote,
      sessionMeta: sessionMetaExport,
      submissions,
      ballots,
      candidateIds,
      poolSnapshot,
      gamesSnapshot,
    };
  }

  async function exportSessionData(voteId) {
    if (!user || !currentGroupId || !voteId) return;

    if (user.isAnonymous) {
      showToast("Saved account required for exports.", "info");
      setSavedAccountRequiredOpen(true);
      return;
    }

    try {
      const payload = await buildSessionExportPayload(voteId);

      const json = JSON.stringify(payload, null, 2);
      const blob = new Blob([json], { type: "application/json" });

      const ts = new Date().toISOString().replace(/[:.]/g, "-");
      const filename = `boardgame-session-${currentGroupId}-${voteId}-${ts}.json`;

      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      URL.revokeObjectURL(url);

      showToast("Export downloaded.", "success");
    } catch (e) {
      console.error("exportSessionData failed:", e);
      showToast(e.code || e.message || "Export failed.", "error");
    }
  }

  async function emailSessionData(voteId) {
    if (!user || !currentGroupId || !voteId) return;

    if (user.isAnonymous) {
      showToast("Saved account required for exports.", "info");
      setSavedAccountRequiredOpen(true);
      return;
    }

    try {
      const payload = await buildSessionExportPayload(voteId);
      const chars = await copyJsonToClipboard(payload);

      showToast(`Export copied to clipboard (${chars} chars). Opening email…`, "success");

      const mailto = buildSessionMailto({
        groupName: currentGroup?.name,
        voteId,
      });

      window.location.href = mailto;
    } catch (e) {
      console.error("emailSessionData failed:", e);
      showToast(e.code || e.message || "Could not email export.", "error");
    }
  }

  // --- UI ---
  const showGameDetail = !!selectedGameFresh;

  const isGroupInlineDetail =
  activeTab === APP_TAB.GROUP && selectedGame && returnCtx?.activeTab === APP_TAB.GROUP;

  const showFab =
    !showAuthPrompt &&
    (activeTab === APP_TAB.LIBRARY || activeTab === APP_TAB.COLLECTION) &&
    !showGameDetail &&
    !isAddGameOpen &&
    !isEditGameOpen;

  const topLevelTabs = [
    { key: APP_TAB.LIBRARY, icon: "📚", label: "Library" },
    { key: APP_TAB.COLLECTION, icon: "🧺", label: "Collection" },
    { key: APP_TAB.GROUP, icon: "👥", label: "Groups" },
    { key: APP_TAB.PROFILE, icon: "👤", label: "Profile" },
  ];

  function handleTopLevelTabClick(nextTab) {
    if (nextTab === APP_TAB.GROUP && isTemporaryAccount) {
      setSavedAccountRequiredOpen(true);
      return;
    }

    setActiveTab(nextTab);
    setSelectedGame(null);
    setSearchQuery("");
  }

  const isDesktopViewport =
    typeof window !== "undefined" && window.matchMedia("(min-width: 768px)").matches;

  return (
    <div className="min-h-screen bg-neutral-950 p-6 pb-32 md:pb-8 text-neutral-100">
      <div className="-mx-6 px-6 pt-4 pb-3 bg-neutral-900/95 backdrop-blur border-b border-neutral-800 md:sticky md:top-0 md:z-40">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight text-white">🎲 Board Game Night</h1>
            <p className="text-xs md:text-sm text-gray-400">
              {activeTab === APP_TAB.LIBRARY && "Browse the full library"}
              {activeTab === APP_TAB.COLLECTION && "Games you can bring"}
              {activeTab === APP_TAB.GROUP && "Pick a group and vote"}
              {activeTab === APP_TAB.PROFILE && "Your nickname and settings"}
            </p>
          </div>

          {!showAuthPrompt && (
            <div className="hidden md:flex items-center gap-2">
              {topLevelTabs.map((t) => {
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    className={`ui-pill ${isActive ? "ui-pill-active" : "ui-pill-inactive"}`}
                    onClick={() => handleTopLevelTabClick(t.key)}
                    disabled={t.key === APP_TAB.COLLECTION && !user}
                    title={t.key === APP_TAB.COLLECTION && !user ? "Sign-in required" : ""}
                  >
                    <span>{t.icon}</span>
                    <span className="text-sm font-medium">{t.label}</span>
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Modal: Auth choice */}
      <Modal
        open={showAuthPrompt}
        title="Welcome"
        onClose={() => { }}
        dismissible={false}
      >
        <p className="text-sm text-gray-300 mb-4">
          Continue with a temporary account to explore the app, or start from Profile to create or sign in to a saved account.
        </p>

        <div className="flex flex-col gap-2">
          <button
            className="ui-btn-primary"
            onClick={() => {
              localStorage.setItem("bgng_auth_choice", "guest");
              setShowAuthPrompt(false);
              signInAnonymously(auth);
            }}
          >
            Continue as guest
          </button>

          <p className="text-xs text-neutral-500 px-1">
            Guest mode starts with a temporary account. You can later create a saved account from Profile without changing this identity.
          </p>

          <button
            className="ui-btn-secondary"
            onClick={() => {
              localStorage.setItem("bgng_auth_choice", "signin");
              setShowAuthPrompt(false);
              setActiveTab(APP_TAB.PROFILE);
              // Start with a temporary account so Profile can offer
              // create-account linking or explicit saved-account sign-in.
              signInAnonymously(auth);
            }}
          >
            Go to account setup
          </button>
        </div>
      </Modal>

      <Modal
        open={savedAccountRequiredOpen}
        title="Saved account required"
        onClose={() => setSavedAccountRequiredOpen(false)}
      >
        <div className="space-y-3">
          <p className="text-sm text-neutral-300">
            Groups, sessions, voting, and shared history require a saved account.
          </p>
          <p className="text-xs text-neutral-500">
            Temporary accounts can keep browsing the library and game details.
          </p>
          <div className="flex flex-wrap items-center gap-2 pt-1">
            <button
              type="button"
              className="ui-btn-primary"
              onClick={() => goToSavedAccountSetup("create")}
            >
              Create account
            </button>
            <button
              type="button"
              className="ui-btn-secondary"
              onClick={() => goToSavedAccountSetup("signin")}
            >
              Sign in
            </button>
            <button
              type="button"
              className="ui-btn-ghost px-3 py-2 text-sm"
              onClick={() => setSavedAccountRequiredOpen(false)}
            >
              Not now
            </button>
          </div>
        </div>
      </Modal>

      {/* Modal: Add Game */}
      <Modal
        open={isAddGameOpen}
        title="Add new game"
        onClose={() => setIsAddGameOpen(false)}
      >
        <AddGameForm form={addGameForm} setForm={setAddGameForm} onSubmit={addGame} />
      </Modal>

      {/* Modal: Edit Game */}
      <Modal
        open={isEditGameOpen}
        title="Edit game"
        onClose={() => setIsEditGameOpen(false)}
      >
        <form onSubmit={saveEditedGame} className="space-y-3">
          <input
            className="w-full"
            placeholder="Title"
            value={editGameForm.title}
            onChange={(e) => setEditGameForm({ ...editGameForm, title: e.target.value })}
            required
          />

          <input
            className="w-full"
            placeholder="Image URL"
            value={editGameForm.imageUrl}
            onChange={(e) => setEditGameForm({ ...editGameForm, imageUrl: e.target.value })}
          />

          {/* image preview */}
          {editGameForm.imageUrl.trim() && (
            <div className="overflow-hidden rounded-xl border bg-neutral-900">
              <img
                src={editGameForm.imageUrl.trim()}
                alt="preview"
                className="block max-h-[32vh] w-full object-contain"
              />
            </div>
          )}

          <textarea
            className="w-full"
            placeholder="Description"
            value={editGameForm.description}
            onChange={(e) => setEditGameForm({ ...editGameForm, description: e.target.value })}
            required
            rows={4}
          />

          <GameTagsField
            value={editGameForm.tags}
            onChange={(tags) => setEditGameForm({ ...editGameForm, tags })}
          />

          <div className="flex items-center justify-between gap-3 pt-2">
          <button
            type="button"
            className="ui-btn-danger"
            onClick={() => deleteGame(editGameForm.id)}
            disabled={!editGameForm.id || isDeletingGame}
            title="Delete game"
          >
            {isDeletingGame ? "Deleting…" : "Delete game"}
          </button>

          <button
            className="ui-btn-primary"
            disabled={isDeletingGame}
          >
            Save changes
          </button>
        </div>
        </form>
      </Modal>

      {/* Profile */}
      {activeTab === APP_TAB.PROFILE && (
        <ProfileCard
          user={user}
          profile={profile}
          nickname={nickname}
          setNickname={setNickname}
          onSaveNickname={saveNickname}
          onSaveAvatarId={saveAvatarId}
          onToast={showToast}
        />
      )}

      {/* Group */}
      {activeTab === APP_TAB.GROUP && (
        <>
          {/* If a game was opened from Group, show details INSTEAD of showing the group list below */}
          {selectedGame && returnCtx?.activeTab === APP_TAB.GROUP ? (
            <GameDetail
              game={selectedGameFresh}
              inCollection={myCollection.has(selectedGameFresh.id)}
              myRating={myRatings.get(selectedGameFresh.id) || null}
              canRate={!isTemporaryAccount}
              onRequireSavedAccount={() => goToSavedAccountSetup("create")}
              onBack={() => {
                setSelectedGame(null);

                // restore the group screen state
                if (returnCtx) {
                  setActiveTab(returnCtx.activeTab);
                  setGroupView(returnCtx.groupView);
                  setGroupTab(returnCtx.groupTab);
                }
                setReturnCtx(null);
              }}
              onRate={(value) => rateGame(selectedGameFresh.id, value)}
              onAdd={() => addToCollection(selectedGameFresh.id)}
              onRemove={() => removeFromCollection(selectedGameFresh.id)}
            />
          ) : (
            <div className="space-y-4">
              {/* PICKER VIEW */}
              {groupView === GROUP_VIEW.PICKER && (
                <GroupsPanel
                  user={user}
                  myGroups={myGroups}
                  currentGroupId={currentGroupId}
                  setCurrentGroupId={selectGroup}
                  onCreateGroup={createGroup}
                  onJoinGroup={joinGroup}
                  onOpenGroup={() => {
                    if (isTemporaryAccount) {
                      setSavedAccountRequiredOpen(true);
                      return;
                    }
                    setGroupView(GROUP_VIEW.DETAIL);
                    setGroupTab(GROUP_TAB.COLLECTION);
                  }}
                />
              )}

              {/* DETAIL VIEW */}
              {groupView === GROUP_VIEW.DETAIL && (
                currentGroup ? (
                  <GroupDetail
                    group={currentGroup}
                    groupTab={groupTab}
                    setGroupTab={setGroupTab}
                    groupSettings={groupSettings}
                    onBack={() => setGroupView(GROUP_VIEW.PICKER)}
                    onLeaveGroup={leaveGroup}
                    groupGames={groupGames}
                    onOpenGame={(game) => {
                      // IMPORTANT: save where we came from so Back restores the Group view
                      setReturnCtx({ activeTab, groupView, groupTab });
                      setSelectedGame(game);
                    }}
                    onToast={showToast}
                    votingNode={
                      <VotingPanel
                        user={user}
                        currentGroupId={currentGroupId}
                        groupSettings={groupSettings}
                        groupGames={groupGames}
                        members={members}
                        activeVote={activeVote}
                        mySubmissionGameId={mySubmissionGameId}
                        myBallot={myBallot}
                        results={voteResults}
                        onCallSession={callSession}
                        onSubmitGame={submitToSession}
                        onSubmitNoSubmission={submitNoSubmission}
                        onStartVoting={startVoting}
                        onCastVote={castVote}
                        onCloseVote={closeVote}
                        onExportSession={exportSessionData}
                        onEmailSession={emailSessionData}
                        canEmailSession={canEmailExport}
                        canManageSession={canManageSession}
                        canCloseActiveVote={canCloseActiveVote}
                        poolActiveIds={poolActiveIds}
                        submittedGameIds={submittedGameIds}
                        groupMemberCount={groupMemberCount}
                        submissionsCount={submissionsCount}
                        ballotsCount={ballotsCount}
                        sessionPlayRecord={sessionPlayRecord}
                        onSaveSessionPlay={saveSessionPlay}
                        isSavingSessionPlay={isSavingSessionPlay}
                        sessionHistory={normalizedSessionHistory}
                        participantSummaryById={participantSummaryById}
                        onSearchAccounts={searchSessionAccounts}
                        onToast={showToast}
                        showArchiveHistory={false}
                      />
                    }
                    historyNode={(
                      <div className="space-y-4">
                        <div className="ui-surface p-5 md:p-6">
                          <div className="flex items-start justify-between gap-4">
                            <div className="min-w-0 flex-1">
                              <h2 className="text-2xl md:text-3xl font-bold text-white">Session archive</h2>
                              <p className="text-sm text-neutral-400 mt-1">
                                A record of all your group's past sessions and outcomes.
                              </p>
                            </div>
                            <span className="ui-chip-muted text-sm shrink-0">{normalizedSessionHistory?.length || 0} session{normalizedSessionHistory?.length === 1 ? "" : "s"}</span>
                          </div>
                        </div>

                        {normalizedSessionHistory && normalizedSessionHistory.length > 0 ? (
                          <div className="space-y-3 px-4 md:px-0">
                            {normalizedSessionHistory.map((play) => {
                              const title = play?.winnerGameId
                                ? (games.find((g) => g.id === play.winnerGameId)?.title || play.winnerGameId)
                                : "No winner";

                              const playedLabel =
                                Number.isFinite(play?.playedAt)
                                  ? new Date(play.playedAt).toLocaleDateString(undefined, {
                                      year: "numeric",
                                      month: "short",
                                      day: "numeric",
                                    })
                                  : "Date unknown";

                              const playResultMode = normalizeResultMode(
                                play?.resultMode,
                                defaultResultMode(play?.winnerGameId)
                              );

                              const playPlacements = normalizeParticipantPlacements(
                                play?.placements,
                                playResultMode,
                                play?.participantIds
                              );

                              const memberLabel = (userId) => {
                                const value = String(userId || "").trim();
                                const summary = participantSummaryById[value];
                                if (summary?.label) return summary.label;
                                if (!value) return "Unknown member";
                                return value.length <= 12
                                  ? value
                                  : `${value.slice(0, 6)}…${value.slice(-4)}`;
                              };

                              const memberAvatar = (userId) => {
                                const value = String(userId || "").trim();
                                const summary = participantSummaryById[value];
                                const avatarId = isValidAvatarId(summary?.avatarId)
                                  ? summary.avatarId
                                  : DEFAULT_AVATAR_ID;
                                const avatar = avatarById(avatarId);

                                return {
                                  src: avatar?.src || null,
                                  icon: avatar?.icon || avatarIconById(avatarId),
                                  label: avatar?.label || "Avatar",
                                };
                              };

                              const resultSummary = (() => {
                                if (playResultMode === "coop-loss") return "Co-op loss recorded.";
                                if (playResultMode === "no-winner") return "No player winner recorded.";
                                if (playResultMode === "coop-win") {
                                  if (!playPlacements.length) return "Co-op win recorded.";
                                  return `Co-op winners: ${playPlacements
                                    .map((entry) => memberLabel(entry.userId))
                                    .join(", ")}`;
                                }
                                if (!playPlacements.length) return "No player placements recorded.";

                                const grouped = new Map();
                                for (const entry of playPlacements) {
                                  const names = grouped.get(entry.place) || [];
                                  names.push(memberLabel(entry.userId));
                                  grouped.set(entry.place, names);
                                }

                                return [...grouped.entries()]
                                  .sort((a, b) => a[0] - b[0])
                                  .map(([place, names]) => {
                                    const placeLabel = (() => {
                                      const x = Number(place);
                                      if (!Number.isFinite(x) || x < 1) return "—";
                                      const abs = Math.abs(Math.trunc(x));
                                      const mod100 = abs % 100;
                                      if (mod100 >= 11 && mod100 <= 13) return `${abs}th`;
                                      switch (abs % 10) {
                                        case 1: return `${abs}st`;
                                        case 2: return `${abs}nd`;
                                        case 3: return `${abs}rd`;
                                        default: return `${abs}th`;
                                      }
                                    })();
                                    return `${placeLabel}: ${names.join(", ")}`;
                                  })
                                  .join(" · ");
                              })();

                              const placementGroups = (() => {
                                if (playResultMode === "coop-win") {
                                  if (!playPlacements.length) return [];
                                  return [{ label: "Winners", userIds: playPlacements.map((entry) => entry.userId) }];
                                }

                                if (playResultMode !== "ranked" || !playPlacements.length) {
                                  return [];
                                }

                                const grouped = new Map();
                                for (const entry of playPlacements) {
                                  const names = grouped.get(entry.place) || [];
                                  names.push(entry.userId);
                                  grouped.set(entry.place, names);
                                }

                                return [...grouped.entries()]
                                  .sort((a, b) => a[0] - b[0])
                                  .map(([place, userIds]) => {
                                    const x = Number(place);
                                    if (!Number.isFinite(x) || x < 1) return { label: "—", userIds };
                                    const abs = Math.abs(Math.trunc(x));
                                    const mod100 = abs % 100;
                                    if (mod100 >= 11 && mod100 <= 13) return { label: `${abs}th`, userIds };
                                    switch (abs % 10) {
                                      case 1: return { label: `${abs}st`, userIds };
                                      case 2: return { label: `${abs}nd`, userIds };
                                      case 3: return { label: `${abs}rd`, userIds };
                                      default: return { label: `${abs}th`, userIds };
                                    }
                                  });
                              })();

                              const playedGamesList = Array.isArray(play?.playedGameIds)
                                ? play.playedGameIds.filter((id) => id !== play?.winnerGameId)
                                : [];

                              const participantBadges = (play?.participantIds || []).map((userId) => {
                                const summary = participantSummaryById[String(userId || "").trim()];
                                return summary || null;
                              }).filter(Boolean);

                              return (
                                <div
                                  key={play.id}
                                  className="ui-surface p-4 md:p-5 space-y-3"
                                >
                                  <div className="flex items-start justify-between gap-4 pb-3 border-b border-neutral-700">
                                    <div>
                                      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-1">Date</div>
                                      <div className="text-sm font-medium text-neutral-300">{playedLabel}</div>
                                    </div>
                                    <div className="flex flex-wrap items-center justify-end gap-2 shrink-0">
                                      <span className={`ui-chip-${playResultMode === "ranked" ? "blue" : playResultMode === "coop-win" ? "green" : "muted"}`}>
                                        {playResultMode === "ranked" ? "Ranked" : playResultMode === "coop-win" ? "Co-op win" : playResultMode === "coop-loss" ? "Co-op loss" : "No winner"}
                                      </span>
                                      {canEditPastSession && (
                                        <button
                                          type="button"
                                          className="ui-btn-secondary px-2.5 py-1 text-xs"
                                          onClick={() => setEditingPastPlay(play)}
                                        >
                                          Edit session
                                        </button>
                                      )}
                                    </div>
                                  </div>

                                  <div>
                                    <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Selected game</div>
                                    <div className="text-lg font-bold text-white">🏆 {title}</div>
                                  </div>

                                  <div>
                                    <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">Result</div>
                                    <div className="text-sm text-neutral-300 leading-relaxed">{resultSummary}</div>

                                    {placementGroups.length > 0 && (
                                      <div className="mt-3 space-y-2">
                                        {placementGroups.map((group) => (
                                          <div key={group.label} className="flex items-start gap-2">
                                            <span className="text-xs text-neutral-500 w-12 shrink-0 mt-1">{group.label}</span>
                                            <div className="flex flex-wrap gap-2 min-w-0">
                                              {group.userIds.map((userId) => {
                                                const avatar = memberAvatar(userId);
                                                return (
                                                  <span
                                                    key={`${group.label}-${userId}`}
                                                    className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
                                                  >
                                                    <span className="h-5 w-5 overflow-hidden rounded-full border border-neutral-600 bg-neutral-800 flex items-center justify-center text-[11px]">
                                                      {avatar.src ? (
                                                        <img
                                                          src={avatar.src}
                                                          alt={avatar.label}
                                                          className="h-full w-full object-cover"
                                                        />
                                                      ) : (
                                                        avatar.icon
                                                      )}
                                                    </span>
                                                    <span>{memberLabel(userId)}</span>
                                                  </span>
                                                );
                                              })}
                                            </div>
                                          </div>
                                        ))}
                                      </div>
                                    )}
                                  </div>

                                  <div>
                                    <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
                                      Participants <span className="text-blue-400">({participantBadges.length})</span>
                                    </div>
                                    {participantBadges.length === 0 ? (
                                      <div className="text-sm text-neutral-400">No participants recorded.</div>
                                    ) : (
                                      <div className="flex flex-wrap gap-2">
                                        {participantBadges.map((participant) => {
                                          const avatar = avatarById(participant.avatarId || DEFAULT_AVATAR_ID);
                                          return (
                                            <span
                                              key={`participant-${play.id}-${participant.userId}`}
                                              className="inline-flex items-center gap-1.5 rounded-full border border-neutral-700 bg-neutral-900 px-2 py-1 text-xs text-neutral-200"
                                            >
                                              <span className="h-5 w-5 overflow-hidden rounded-full border border-neutral-600 bg-neutral-800 flex items-center justify-center text-[11px]">
                                                {avatar?.src ? (
                                                  <img
                                                    src={avatar.src}
                                                    alt={avatar?.label || "Avatar"}
                                                    className="h-full w-full object-cover"
                                                  />
                                                ) : (
                                                  avatar?.icon || avatarIconById(participant.avatarId)
                                                )}
                                              </span>
                                              <span>{participant.label}</span>
                                              {!participant.isMember && (
                                                <span className="text-neutral-400">(Guest)</span>
                                              )}
                                            </span>
                                          );
                                        })}
                                      </div>
                                    )}
                                  </div>

                                  {playedGamesList.length > 0 && (
                                    <div>
                                      <div className="text-xs uppercase tracking-wide text-neutral-500 mb-2">
                                        Also played <span className="text-blue-400">({playedGamesList.length})</span>
                                      </div>
                                      <div className="text-sm text-neutral-300 leading-relaxed">
                                        {playedGamesList
                                          .map((id) => games.find((g) => g.id === id)?.title || id)
                                          .join(", ")}
                                      </div>
                                    </div>
                                  )}
                                </div>
                              );
                            })}
                          </div>
                        ) : (
                          <div className="ui-surface p-5 md:p-6 text-center">
                            <p className="text-sm text-neutral-400">No session history yet. Complete your first session to start building your archive.</p>
                          </div>
                        )}
                      </div>
                    )}
                    toolsNode={(
                      <GroupToolsPanel
                        currentGroupId={currentGroupId}
                        members={members}
                        memberProfilesById={memberProfilesById}
                        sessionParticipantIds={currentSessionParticipantIds}
                        participantSummaryById={participantSummaryById}
                      />
                    )}
                    statisticsNode={(
                      <GroupStatisticsPanel
                        sessionHistory={normalizedSessionHistory}
                        games={games}
                        participantSummaryById={participantSummaryById}
                      />
                    )}
                    canEditNewness={user?.uid === currentGroup?.ownerId}
                    onTogglePlayedOverride={togglePlayedOverride}
                    settingsNode={
                      <GroupSettingsPanel
                        group={currentGroup}
                        user={user}
                        members={members}
                        myRole={myRole}
                        meta={groupSettings}
                        availableTags={groupAvailableTags}
                        canEditMeta={canEditGroupMeta}
                        canEditWeights={canEditWeights}
                        weights={groupWeightOverrides}
                        onSaveWeights={saveGroupWeights}
                        onResetWeights={resetGroupWeightsInFirestore}
                        onSaveMeta={saveGroupMeta}
                        onSetMemberRole={setMemberRole}
                        onTransferOwnership={transferGroupOwnership}
                        onInitMeta={async () => {
                          await bootstrapGroupMeta(currentGroupId);
                          showToast("Group settings initialized ✅", "success");
                        }}
                      />
                    }
                    myCollectionGames={collectionGames}
                    mySharedGameIds={mySharedGameIdsInCurrentGroup}
                    onSetMyGameSharedInGroup={setMyGameSharedInGroup}
                  />
                ) : (
                  <div className="ui-surface p-4">
                    <p className="text-sm text-gray-300 mb-3">
                      No group selected. Please pick a group to continue.
                    </p>
                    <button
                      className="text-sm text-blue-400 hover:underline"
                      onClick={() => setGroupView(GROUP_VIEW.PICKER)}
                    >
                      ← Back to groups
                    </button>
                  </div>
                )
              )}
            </div>
          )}
        </>
      )}

      {/* Library / Collection */}
      {!showAuthPrompt &&
      user &&
      (activeTab === "library" || activeTab === "collection") &&
      !showGameDetail && (
        <>
          {/* Search & Tag Filter */}
          <div className="mt-4 mb-5 ui-surface-subtle p-3 md:p-4 space-y-3 sticky top-0 md:top-[86px] z-30">
            <div className="flex items-start justify-between gap-3 flex-wrap">
              <div>
                <div className="flex items-center gap-2">
                  <h2 className="text-lg md:text-xl font-semibold text-white">
                    {activeTab === "library" ? "Library" : "My Collection"}
                  </h2>
                  {activeTab === "collection" && (
                    <span className="ui-chip-muted">Owned: {myCollection.size}</span>
                  )}
                </div>
                <p className="text-sm text-neutral-400">
                  {activeTab === "library"
                    ? "Browse and discover games"
                    : "Your personal shelf of games"}
                </p>
              </div>
            </div>

            <div className="flex gap-2 flex-wrap items-center">
              <input
                type="text"
                placeholder={
                  activeTab === "library"
                    ? "Search library games…"
                    : "Search your collection…"
                }
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="flex-1 min-w-[220px] md:max-w-xl px-5 py-2.5"
              />
              <GameTagFilter
                availableTags={getUniqueTagsFromGames(
                  activeTab === "collection" ? collectionGames : libraryGames
                )}
                selectedTags={selectedTagFilters}
                onTagsChange={setSelectedTagFilters}
              />
            </div>

            {selectedTagFilters.length > 0 && (
              <div className="flex flex-wrap gap-2 pt-1">
                {selectedTagFilters.map((tag) => (
                  <span
                    key={tag}
                    className="ui-chip-blue"
                  >
                    ✓ {tag}
                    <button
                      type="button"
                      className="text-blue-200 hover:text-white ml-1"
                      onClick={() =>
                        setSelectedTagFilters(selectedTagFilters.filter((t) => t !== tag))
                      }
                      aria-label={`Remove ${tag} filter`}
                    >
                      ×
                    </button>
                  </span>
                ))}
              </div>
            )}
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-5 items-start">
            {(activeTab === "collection" ? collectionGames : libraryGames).map(
              (game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  inCollection={myCollection.has(game.id)}
                  onOpen={() => setSelectedGame(game)}
                  onAdd={() => addToCollection(game.id)}
                  onRemove={() => removeFromCollection(game.id)}
                  view={activeTab}
                />
              )
            )}
          </div>
        </>
      )}

      {/* Floating Add Game button (FAB) */}
      <Fab
        show={showFab}
        onClick={() => setIsAddGameOpen(true)}
        label="Add new game"
        bottom={isDesktopViewport ? 24 : 96}
      />

      {!showAuthPrompt && (
        <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-neutral-700 bg-neutral-900/95 backdrop-blur md:hidden">
          <div className="mx-auto w-full max-w-3xl px-3 py-2">
            <div className="grid grid-cols-4 gap-2">
              {topLevelTabs.map((t) => {
                const isActive = activeTab === t.key;
                return (
                  <button
                    key={t.key}
                    className={[
                      "flex flex-col items-center justify-center rounded-xl py-1.5 px-2 text-xs transition",
                      isActive
                        ? "bg-neutral-700 text-white"
                        : "text-neutral-300 hover:bg-neutral-800",
                    ].join(" ")}
                    onClick={() => handleTopLevelTabClick(t.key)}
                    disabled={t.key === APP_TAB.COLLECTION && !user}
                    title={t.key === APP_TAB.COLLECTION && !user ? "Sign-in required" : ""}
                  >
                    <span className="text-base leading-none">{t.icon}</span>
                    <span className="mt-1 font-medium">{t.label}</span>
                  </button>
                );
              })}
            </div>
          </div>
        </nav>
      )}

      {/* Game detail (works from any tab) */}
      {showGameDetail && !isGroupInlineDetail && (
        <GameDetail
          game={selectedGameFresh}
          inCollection={myCollection.has(selectedGameFresh.id)}
          myRating={myRatings.get(selectedGameFresh.id) || null}
          canRate={!isTemporaryAccount}
          onRequireSavedAccount={() => goToSavedAccountSetup("create")}
          onBack={() => setSelectedGame(null)}
          onRate={(value) => rateGame(selectedGameFresh.id, value)}
          onAdd={() => addToCollection(selectedGameFresh.id)}
          onRemove={() => removeFromCollection(selectedGameFresh.id)}
          // canEdit={user?.uid && selectedGameFresh.createdBy === user.uid}
          canEdit={!!user}
          onEdit={() => openEditGame(selectedGameFresh)}
        />
      )}

      <Modal
        open={!!winnerModal}
        title="Winner"
        onClose={() => setWinnerModal(null)}
      >
        {(() => {
          if (!winnerModal) return null;

          const gameMap = new Map(games.map((g) => [g.id, g]));
          const winnerTitle =
            winnerModal.winnerGameId
              ? (gameMap.get(winnerModal.winnerGameId)?.title || winnerModal.winnerGameId)
              : null;

          const rows = Array.isArray(winnerModal.scoreBreakdown)
            ? winnerModal.scoreBreakdown
            : [];

          // show only games that actually received votes (your rule)
          const scored = rows
            .map((r) => ({
              gameId: r.gameId,
              title: gameMap.get(r.gameId)?.title || r.gameId,
              score: Number(r.score ?? r.finalScore ?? r.weightedScore ?? r.totalScore ?? 0),
              votes: Number(r.sessionVotes ?? r.votes ?? r.voteCount ?? 0),
            }))
            .filter((r) => r.votes > 0 || r.score > 0)
            .sort((a, b) => b.score - a.score);

          if (!winnerModal.winnerGameId) {
            return (
              <p className="text-sm text-gray-300">
                No votes were cast, so there is no winner.
              </p>
            );
          }

          const winnerRow = scored.find((r) => r.gameId === winnerModal.winnerGameId);

          return (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border border-neutral-700 bg-neutral-900">
                <div className="text-sm text-gray-400">Winner</div>
                <div className="text-lg font-semibold text-white">{winnerTitle}</div>
                {winnerRow && (
                  <div className="text-sm text-gray-300 mt-1">
                    Score:  <span className="font-semibold">{winnerRow.score.toFixed(2)}</span>
                    {winnerRow.votes ? (
                      <span className="text-gray-400"> · Votes: {winnerRow.votes}</span>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold mb-2 text-white">Scores</div>
                {scored.length === 0 ? (
                  <p className="text-sm text-gray-300">No scored candidates.</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {scored.map((r) => (
                      <li key={r.gameId} className="flex justify-between gap-3">
                        <span className={r.gameId === winnerModal.winnerGameId ? "font-semibold text-white" : "text-gray-300"}>
                          {r.title}
                        </span>
                        <span className="text-gray-300 tabular-nums">
                          {r.score.toFixed(2)}
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </div>
          );
        })()}
      </Modal>

      {/* Modal: Edit past session */}
      <Modal
        open={!!editingPastPlay}
        title="Edit session"
        onClose={() => setEditingPastPlay(null)}
      >
        {editingPastPlay && (
          <PastSessionEditModal
            play={editingPastPlay}
            groupGames={groupGames}
            members={members}
            participantSummaryById={participantSummaryById}
            onSearchAccounts={searchSessionAccounts}
            onToast={showToast}
            isSaving={isSavingPastPlay}
            onSave={(payload) => savePastSessionPlay(editingPastPlay, payload)}
            onClose={() => setEditingPastPlay(null)}
          />
        )}
      </Modal>

      <Toast toasts={toasts} onClose={closeToast} />
    </div>
  );
}
