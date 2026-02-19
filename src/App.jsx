// src/App.jsx
import { useEffect, useMemo, useState, useCallback} from "react";
import {
  addDoc,
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocFromServer,
  getDocs,
  increment,
  onSnapshot,
  orderBy,
  query,
  setDoc,
  where,
  updateDoc,
  writeBatch,
  runTransaction,
} from "firebase/firestore";
import { getAuth, onAuthStateChanged, signInAnonymously } from "firebase/auth";
import { db } from "./firebase";
import { pickWeightedWinner, DEFAULT_WEIGHTS } from "./weights/weighting";

import ProfileCard from "./components/ProfileCard";
import AddGameForm from "./components/AddGameForm";
import GameCard from "./components/GameCard";
import GameDetail from "./components/GameDetail";
import GroupDetail from "./components/GroupDetail";
import GroupsPanel from "./components/GroupsPanel";
import VotingPanel from "./components/VotingPanel";
import Toast from "./components/ui/Toast";
import Fab from "./components/ui/Fab";
import GroupSettingsPanel from "./components/GroupSettingsPanel";
import { buildSessionMailto, copyJsonToClipboard } from "./utils/emailExport";

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
        className="absolute inset-0 bg-black/40"
        onClick={dismissible ? onClose : undefined}
        aria-hidden="true"
        style={{
          pointerEvents: dismissible ? "auto" : "none",
        }}
      />

      <div className="relative w-full max-w-xl bg-white rounded-2xl shadow-xl border border-gray-200">
        <div className="flex items-center justify-between p-4 border-b">
          <h2 className="text-lg font-semibold">{title}</h2>

          {dismissible && (
            <button
              className="px-3 py-1 rounded border bg-white"
              onClick={onClose}
            >
              Close
            </button>
          )}
        </div>

        <div className="p-4">{children}</div>
      </div>
    </div>
  );
}

export default function App() {
  const [user, setUser] = useState(null);
  const [profile, setProfile] = useState(null);
  const [nickname, setNickname] = useState("");

  const [showAuthPrompt, setShowAuthPrompt] = useState(false);

  const [games, setGames] = useState([]);
  const [selectedGame, setSelectedGame] = useState(null);

  const [myCollection, setMyCollection] = useState(new Set());

  const [activeTab, setActiveTab] = useState("library"); // library | collection | group | profile

  const [searchQuery, setSearchQuery] = useState("");

  const [myGroups, setMyGroups] = useState([]);
  const [currentGroupId, setCurrentGroupId] = useState("");
  const [members, setMembers] = useState([]);

  const [groupView, setGroupView] = useState("picker"); // "picker" | "detail"
  const [groupTab, setGroupTab] = useState("collection");

  const [groupGameRefs, setGroupGameRefs] = useState([]); // { id, ownersCount, updatedAt }
  const [groupWeightOverrides, setGroupWeightOverrides] = useState(null);
  const [groupSettings, setGroupSettings] = useState(null);

  const [votes, setVotes] = useState([]);

  const [myBallot, setMyBallot] = useState(null);
  const [voteBallots, setVoteBallots] = useState([]);

  const [winnerModal, setWinnerModal] = useState(null);

  const [poolDocs, setPoolDocs] = useState([]); // [{id, ...data}]
  const [mySubmissionGameId, setMySubmissionGameId] = useState(null);
  const [sessionSubmissions, setSessionSubmissions] = useState([]); // [{ userId, gameId, submittedAt }]

  const [sessionMeta, setSessionMeta] = useState(null);

  const [isAddGameOpen, setIsAddGameOpen] = useState(false);
  const [addGameForm, setAddGameForm] = useState({
    title: "",
    description: "",
    imageUrl: "",
  });

  const [myRatings, setMyRatings] = useState(new Map());

  const [toasts, setToasts] = useState([]);

  const [isEditGameOpen, setIsEditGameOpen] = useState(false);
  const [editGameForm, setEditGameForm] = useState({
    id: "",
    title: "",
    description: "",
    imageUrl: "",
  });

  const [returnCtx, setReturnCtx] = useState(null);

  const currentGroup = useMemo(
    () => myGroups.find((g) => g.id === currentGroupId) || null,
    [myGroups, currentGroupId]
  );

  const activeVote = useMemo(() => {
    if (!votes.length) return null;
    return (
      votes.find(v => v.status === "collecting") ||
      votes.find(v => v.status === "open") ||
      votes[0] // last closed (latest)
    );
  }, [votes]);

  const canManageSession = useMemo(() => {
    if (!user || !activeVote) return false;
    const isVoteOwner = activeVote.createdBy === user.uid;
    const isGroupOwner = currentGroup?.ownerId === user.uid;
    return isVoteOwner || isGroupOwner;
  }, [user, activeVote, currentGroup]);

  const canCloseActiveVote = useMemo(() => {
    if (!user || !activeVote || activeVote.status !== "open") return false;
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
            await setDoc(ref, { nickname: "", createdAt: Date.now() });
            setProfile({ nickname: "" });
            setNickname("");
            return;
          }

          const data = snap.data();
          setProfile(data);
          setNickname(data.nickname || "");
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

  // --- Games (global) ---
  useEffect(() => {
    if (!user) {
      setGames([]);
      return;
    }
  
    const q = query(collection(db, "games"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setGames(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("Games listener error:", err);
        setGames([]);
      }
    );
  
    return unsub;
  }, [user]);

  // --- My collection ---
  useEffect(() => {
    if (!user) return;

    const colRef = collection(db, "users", user.uid, "collection");
    const unsub = onSnapshot(colRef, (snap) => {
      setMyCollection(
        new Set(
          snap.docs.map((d) => d.data()?.gameId || d.id).filter(Boolean)
        )
      );
    });

    return unsub;
  }, [user]);

  // --- My groups + group docs ---
  useEffect(() => {
    if (!user) return;

    const ref = collection(db, "users", user.uid, "groups");
    const unsub = onSnapshot(ref, async (snap) => {
      const ids = snap.docs.map((d) => d.id);

      const groupDocs = await Promise.all(
        ids.map(async (id) => {
          const gSnap = await getDoc(doc(db, "groups", id));
          return { id, ...(gSnap.exists() ? gSnap.data() : {}) };
        })
      );

      setMyGroups(groupDocs);

      if (!currentGroupId && ids.length > 0) setCurrentGroupId(ids[0]);
      if (currentGroupId && ids.length > 0 && !ids.includes(currentGroupId)) {
        setCurrentGroupId(ids[0]);
      }
      if (ids.length === 0) setCurrentGroupId("");
    });

    return unsub;
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user]);

  useEffect(() => {
    if (!currentGroupId) {
      setGroupWeightOverrides(null);
      return;
    }
    const ref = doc(db, "groups", currentGroupId, "settings", "weights");
    return onSnapshot(ref, (snap) => {
      setGroupWeightOverrides(snap.exists() ? snap.data() : null);
    });
  }, [currentGroupId]);

  // --Suscribe to settings --
  useEffect(() => {
    if (!user || !currentGroupId) return;

    const ref = doc(db, "groups", currentGroupId, "settings", "meta");
    return onSnapshot(ref, (snap) => {
      setGroupSettings(snap.exists() ? snap.data() : null);
    });
  }, [user, currentGroupId]);

  // -- Group members --
  useEffect(() => {
    if (!user || !currentGroupId) {
      setMembers([]);
      return;
    }

    const ref = collection(db, "groups", currentGroupId, "members");
    return onSnapshot(ref, (snap) => {
      setMembers(snap.docs.map((d) => ({ userId: d.id, ...d.data() })));
    });
  }, [user, currentGroupId]);

  // --- Materialized group collection ---
  useEffect(() => {
    if (!currentGroupId) {
      setGroupGameRefs([]);
      return;
    }

    const ref = query(
      collection(db, "groups", currentGroupId, "games"),
      orderBy("ownersCount", "desc")
    );

    const unsub = onSnapshot(ref, (snap) => {
      setGroupGameRefs(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });

    return unsub;
  }, [currentGroupId]);

  useEffect(() => {
    if (!currentGroupId) {
      setVotes([]);
      return;
    }

    const ref = query(
      collection(db, "groups", currentGroupId, "votes"),
      orderBy("createdAt", "desc")
    );

    return onSnapshot(ref, (snap) => {
      setVotes(snap.docs.map((d) => ({ id: d.id, ...d.data() })));
    });
  }, [currentGroupId]);

  // --- Ballots for active vote ---
  useEffect(() => {
    if (!user || !currentGroupId || !activeVote?.id) {
      setMyBallot(null);
      setVoteBallots([]);
      return;
    }

    const myRef = doc(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVote?.id,
      "ballots",
      user.uid
    );

    const unsubMy = onSnapshot(myRef, (snap) => {
      setMyBallot(snap.exists() ? snap.data() : null);
    });

    const allRef = collection(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVote?.id,
      "ballots"
    );

    const unsubAll = onSnapshot(allRef, (snap) => {
      setVoteBallots(snap.docs.map((d) => ({ userId: d.id, ...d.data() })));
    });

    return () => {
      unsubMy();
      unsubAll();
    };
  }, [user, currentGroupId, activeVote?.id]);

  useEffect(() => {
    if (!currentGroupId) {
      setPoolDocs([]);
      return;
    }
  
    const ref = collection(db, "groups", currentGroupId, "pool");
  
    return onSnapshot(ref, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  
      // Optional: sort, but don’t depend on the field existing
      docs.sort((a, b) => {
        const ax = typeof a.cycleStartedAt === "number" ? a.cycleStartedAt : Number.MAX_SAFE_INTEGER;
        const bx = typeof b.cycleStartedAt === "number" ? b.cycleStartedAt : Number.MAX_SAFE_INTEGER;
        return ax - bx;
      });
  
      setPoolDocs(docs);
    });
  }, [currentGroupId]);

    // --- All submissions for active vote (collecting phase) ---
  useEffect(() => {
    if (!currentGroupId || !activeVote?.id || activeVote?.status !== "collecting") {
      setSessionSubmissions([]);
      return;
    }

    const ref = collection(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVote.id,
      "submissions"
    );

    return onSnapshot(ref, (snap) => {
      setSessionSubmissions(
        snap.docs.map((d) => ({ userId: d.id, ...d.data() }))
      );
    });
  }, [currentGroupId, activeVote?.id, activeVote?.status]);

  useEffect(() => {
    if (!user?.uid || !currentGroupId || !activeVote?.id) {
      setMySubmissionGameId(null);
      return;
    }

    const ref = doc(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVote.id,
      "submissions",
      user.uid
    );

    return onSnapshot(ref, (snap) => {
      setMySubmissionGameId(snap.exists() ? snap.data()?.gameId ?? null : null);
    });
  }, [user?.uid, currentGroupId, activeVote?.id]);

  // --- My ratings ---
  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "ratings"),
      where("userId", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const map = new Map();
      snap.forEach((d) => {
        map.set(d.data().gameId, d.data().value);
      });
      setMyRatings(map);
    });

    return unsub;
  }, [user]);

  useEffect(() => {
    if (activeTab !== "group") return;

    if (groupView === "detail" && !currentGroupId) {
      setGroupView("picker");
    }
  }, [activeTab, groupView, currentGroupId]);

  useEffect(() => {
    if (!currentGroupId) {
      setSessionMeta(null);
      return;
    }

    const ref = doc(db, "groups", currentGroupId, "activeSession", "meta");
    return onSnapshot(ref, (snap) => {
      setSessionMeta(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [currentGroupId]);

  useEffect(() => {
    if (!user || !profile?.nickname || myGroups.length === 0) return;
    syncMyNicknameToGroupMemberships(profile.nickname).catch(console.error);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.uid, profile?.nickname, myGroups.length]);

  // --- Derived views ---
  const selectedGameFresh = useMemo(() => {
    if (!selectedGame) return null;
    return games.find((g) => g.id === selectedGame.id) || selectedGame;
  }, [games, selectedGame]);

  const normalizedQuery = searchQuery.trim().toLowerCase();

  const libraryGames = useMemo(() => {
    if (!normalizedQuery) return games;
    return games.filter((g) =>
      g.title?.toLowerCase().includes(normalizedQuery)
    );
  }, [games, normalizedQuery]);

  const collectionGames = useMemo(() => {
    const base = games.filter((g) => myCollection.has(g.id));
    if (!normalizedQuery) return base;
    return base.filter((g) =>
      g.title?.toLowerCase().includes(normalizedQuery)
    );
  }, [games, myCollection, normalizedQuery]);

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

  const voteResults = useMemo(() => {
    if (!activeVote || activeVote.status !== "closed") return [];

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

  function openEditGame(game) {
    setEditGameForm({
      id: game.id,
      title: game.title || "",
      description: game.description || "",
      imageUrl: game.imageUrl || "",
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

  async function syncMyNicknameToGroupMemberships(nextNickname) {
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
  }

  async function saveNickname() {
    if (!user) return;
    const trimmed = nickname.trim();

    await updateDoc(doc(db, "users", user.uid), { nickname: trimmed });
    setProfile((p) => ({ ...(p || {}), nickname: trimmed }));
    setNickname(trimmed);

    await syncMyNicknameToGroupMemberships(trimmed);
  }

  function safeString(v) {
    if (v == null) return "";
    return String(v);
  }

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
  

  async function addGame(e) {
    e.preventDefault();

    if (!isValidImageUrl(addGameForm.imageUrl)) {
      showToast("Image URL must end with .jpg, .png, .webp, or .gif", "error");
      return;
    }

    if (!user) {
      showToast("Signing in… try again.", "info");
      return;
    }

    await addDoc(collection(db, "games"), {
      ...addGameForm,
      createdBy: user.uid,
      ratingTotal: 0,
      ratingCount: 0,
      createdAt: Date.now(),
    });

    setAddGameForm({ title: "", description: "", imageUrl: "" });
    setIsAddGameOpen(false);
  }

  async function addGameToAllMyGroups(gameId) {
    if (!user) return;

    const groupIds = myGroups.map((g) => g.id);
    if (groupIds.length === 0) return;

    const batch = writeBatch(db);

    for (const groupId of groupIds) {
      const gameRef = doc(db, "groups", groupId, "games", gameId);
      const ownerRef = doc(
        db,
        "groups",
        groupId,
        "games",
        gameId,
        "owners",
        user.uid
      );

      batch.set(ownerRef, { addedAt: Date.now() });
      batch.set(
        gameRef,
        { ownersCount: increment(1), updatedAt: Date.now() },
        { merge: true }
      );
    }

    await batch.commit();
  }

  async function removeGameFromAllMyGroups(gameId) {
    if (!user) return;

    const groupIds = myGroups.map((g) => g.id);
    if (groupIds.length === 0) return;

    const batch = writeBatch(db);

    for (const groupId of groupIds) {
      const gameRef = doc(db, "groups", groupId, "games", gameId);
      const ownerRef = doc(
        db,
        "groups",
        groupId,
        "games",
        gameId,
        "owners",
        user.uid
      );

      batch.delete(ownerRef);
      batch.set(
        gameRef,
        { ownersCount: increment(-1), updatedAt: Date.now() },
        { merge: true }
      );
    }

    await batch.commit();
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

  async function rateGame(gameId, value) {
    if (!user) return;

    // enforce 0.5 steps + range on client
    const v = Math.round(Number(value) * 2) / 2;
    if (!(v >= 0.5 && v <= 5)) return;

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

    try {
      await updateDoc(doc(db, "games", editGameForm.id), {
        title: editGameForm.title.trim(),
        description: editGameForm.description.trim(),
        imageUrl: editGameForm.imageUrl.trim(),
        updatedAt: Date.now(),
      });
      showToast("Game updated ✅", "success");
      setIsEditGameOpen(false);
    } catch (err) {
      console.error("saveEditedGame failed:", err);
      showToast(err.code || "Failed to update game.", "error");
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
        // autoAdvanceWhenAllSubmitted: false,

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
      });

      await setDoc(doc(db, "users", user.uid, "groups", id), {
        joinedAt: Date.now(),
        syncedCollectionAt: null,
      }, { merge: true });

      await bootstrapGroupMeta(groupRef.id);

      await syncMyCollectionToGroup(groupId);

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
        setGroupView("picker");
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

    await setDoc(doc(db, "groups", currentGroupId, "settings", "meta"), patch, { merge: true });
    showToast("Group rules saved.", "success");
  }

  async function togglePlayedOverride(gameId, playedOverride) {
    if (!user || !currentGroupId) return;
  
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
    if (activeVote.status !== "open") return;

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

  async function closeVote() {
    if (!user || !currentGroupId || !activeVote?.id || !activeVote) return;
    if (activeVote.status !== "open") return;

    if (!canCloseActiveVote) {
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
      const { winnerGameId, scoreBreakdown, weightsUsed } = pickWeightedWinner({
        voteCounts,
        poolMap,
        now,
        sessionIndex,
        weights: effectiveWeights,
      });

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
        status: "closed",
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

      // Winner leaves pool, write play log
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

        const playRef = doc(collection(db, "groups", currentGroupId, "plays"));
        batch.set(playRef, {
          gameId: winnerGameId,
          playedAt: now,
          voteId: activeVote.id,
          recordedBy: user.uid,
        });
      }

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
      showToast(e.code || e.message || "Failed to close vote.", "error");
    }
  }

  async function callSession() {
    if (!user || !currentGroupId) return;

    if (activeVote && (activeVote.status === "collecting" || activeVote.status === "open")) {
      showToast("A session is already active.", "info");
      return;
    }

    const now = Date.now();

    const voteRef = await addDoc(collection(db, "groups", currentGroupId, "votes"), {
      status: "collecting",
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
        status: "collecting",
        sessionIndex: currentIndex,
        updatedAt: now,
      },
      { merge: true }
    );

    showToast("Session started. Collecting submissions…", "success");
  }

  async function submitToSession(gameId) {
  if (!user || !currentGroupId || !activeVote?.id || !activeVote) return;

  if (activeVote.status !== "collecting") {
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

  const poolRef = doc(db, "groups", currentGroupId, "pool", gameId);

  try {
    await runTransaction(db, async (tx) => {
      const [subSnap, poolSnap] = await Promise.all([
        tx.get(submissionRef),
        tx.get(poolRef),
      ]);

      // Enforce: 1 submission per user per collecting phase
      if (subSnap.exists()) {
        throw new Error("You already submitted a game for this session.");
      }

      // Enforce: cannot submit a game already active in the pool
      if (poolSnap.exists() && poolSnap.data()?.isActive === true) {
        throw new Error("That game is already in the pool.");
      }

      // Write submission (one doc per user)
      tx.set(submissionRef, {
        gameId,
        submittedAt: now,
      });

      // Activate/reactivate pool entry (this is what makes it disappear for everyone)
      if (!poolSnap.exists()) {
        // true create path (allowed to include addedAt)
        tx.set(poolRef, {
          isActive: true,
          addedAt: now,
          cycleStartedAt: now,
          cycleVoteCount: 0,
          cycleStartedSession: sessionIndex,
        });
      } else {
        // update path + repair empty docs
        tx.set(
          poolRef,
          {
            isActive: true,
            cycleStartedAt: now,
            cycleVoteCount: 0,
            cycleStartedSession: sessionIndex,
          },
          { merge: true }
        );
      }
    });

    showToast("Submitted ✅", "success");
  } catch (e) {
    console.error("submitToSession failed:", e);
    showToast(e?.message || e?.code || "Submission failed.", "error");
  }
}

  async function startVoting() {
    if (!user || !currentGroupId || !activeVote?.id || !activeVote) return;
    if (activeVote.status !== "collecting") return;

    const isVoteOwner = activeVote.createdBy === user.uid;
    const isGroupOwner = currentGroup?.ownerId === user.uid;
    if (!isVoteOwner && !isGroupOwner) {
      showToast("Only the session owner can start voting.", "error");
      return;
    }

    const subsSnap = await getDocs(
      collection(db, "groups", currentGroupId, "votes", activeVote?.id, "submissions")
    );

    const submittedIds = subsSnap.docs.map(d => d.data().gameId);

    // Snapshot candidates now
    const candidates = Array.from(new Set([...activePoolGameIds, ...submittedIds]));

    await updateDoc(doc(db, "groups", currentGroupId, "votes", activeVote.id), {
      status: "open",
      openedAt: Date.now(),
      candidates,
    });

    await updateDoc(doc(db, "groups", currentGroupId, "activeSession", "meta"), {
      status: "open",
      updatedAt: Date.now(),
    });

    showToast("Voting is open 🎲", "success");
  }

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
  activeTab === "group" && selectedGame && returnCtx?.activeTab === "group";

  const showFab =
    !showAuthPrompt &&
    (activeTab === "library" || activeTab === "collection") &&
    !showGameDetail &&
    !isAddGameOpen &&
    !isEditGameOpen;

  const sessionIndex = Number(sessionMeta?.sessionIndex || 0);

  return (
    <div className="min-h-screen bg-gray-100 p-6">
      <div className="sticky top-0 z-40 -mx-6 px-6 pt-4 pb-3 bg-gray-100/90 backdrop-blur border-b border-gray-200">
        <div className="flex items-center justify-between">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold leading-tight">🎲 Board Game Night</h1>
            <p className="text-xs md:text-sm text-gray-600">
              {activeTab === "library" && "Browse the full library"}
              {activeTab === "collection" && "Games you can bring"}
              {activeTab === "group" && "Pick a group and vote"}
              {activeTab === "profile" && "Your nickname and settings"}
            </p>
          </div>
        </div>

        {!showAuthPrompt && (
          <div className="mt-3 flex gap-2 flex-wrap">
            {[
              { key: "library", label: "📚 Library" },
              { key: "collection", label: "🧺 My Collection" },
              { key: "group", label: "👥 Group" },
              { key: "profile", label: "👤 Profile" },
            ].map((t) => {
              const isActive = activeTab === t.key;
              return (
                <button
                  key={t.key}
                  className={`px-3 py-2 rounded-full border transition ${isActive
                      ? "bg-white border-gray-300 shadow-sm"
                      : "bg-gray-100 border-gray-200 hover:bg-gray-50"
                    }`}
                  onClick={() => {
                    setActiveTab(t.key);
                    setSelectedGame(null);
                    setSearchQuery("");
                  }}
                  disabled={t.key === "collection" && !user}
                  title={t.key === "collection" && !user ? "Sign-in required" : ""}
                >
                  <span className="text-sm font-medium text-gray-900">{t.label}</span>
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Modal: Auth choice */}
      <Modal
        open={showAuthPrompt}
        title="Welcome"
        onClose={() => { }}
        dismissible={false}
      >
        <p className="text-sm text-gray-700 mb-4">
          Sign in to keep your data across devices, or continue as a guest.
        </p>

        <div className="flex flex-col gap-2">
          <button
            className="bg-blue-600 text-white px-4 py-2 rounded"
            onClick={() => {
              localStorage.setItem("bgng_auth_choice", "guest");
              setShowAuthPrompt(false);
              signInAnonymously(auth);
            }}
          >
            Continue as guest
          </button>

          <button
            className="border px-4 py-2 rounded bg-white hover:bg-gray-50"
            onClick={() => {
              localStorage.setItem("bgng_auth_choice", "signin");
              setShowAuthPrompt(false);
              setActiveTab("profile");
              // ProfileCard will show Sign in UI
            }}
          >
            Sign in
          </button>
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
            className="border p-2 w-full rounded"
            placeholder="Title"
            value={editGameForm.title}
            onChange={(e) => setEditGameForm({ ...editGameForm, title: e.target.value })}
            required
          />

          <input
            className="border p-2 w-full rounded"
            placeholder="Image URL"
            value={editGameForm.imageUrl}
            onChange={(e) => setEditGameForm({ ...editGameForm, imageUrl: e.target.value })}
          />

          {/* image preview */}
          {editGameForm.imageUrl.trim() && (
            <img
              src={editGameForm.imageUrl.trim()}
              alt="preview"
              className="rounded-xl border"
            />
          )}

          <textarea
            className="border p-2 w-full rounded"
            placeholder="Description"
            value={editGameForm.description}
            onChange={(e) => setEditGameForm({ ...editGameForm, description: e.target.value })}
            required
            rows={4}
          />

          <button className="bg-blue-600 text-white px-4 py-2 rounded">
            Save changes
          </button>
        </form>
      </Modal>

      {/* Profile */}
      {activeTab === "profile" && (
        <ProfileCard
          user={user}
          profile={profile}
          nickname={nickname}
          setNickname={setNickname}
          onSaveNickname={saveNickname}
        />
      )}

      {/* Group */}
      {activeTab === "group" && (
        <>
          {/* If a game was opened from Group, show details INSTEAD of showing the group list below */}
          {selectedGame && returnCtx?.activeTab === "group" ? (
            <GameDetail
              game={selectedGameFresh}
              inCollection={myCollection.has(selectedGameFresh.id)}
              myRating={myRatings.get(selectedGameFresh.id) || null}
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
              {groupView === "picker" && (
                <GroupsPanel
                  user={user}
                  myGroups={myGroups}
                  currentGroupId={currentGroupId}
                  setCurrentGroupId={setCurrentGroupId}
                  onCreateGroup={createGroup}
                  onJoinGroup={joinGroup}
                  onOpenGroup={() => {
                    setGroupView("detail");
                    setGroupTab("collection");
                  }}
                />
              )}

              {/* DETAIL VIEW */}
              {groupView === "detail" && (
                currentGroup ? (
                  <GroupDetail
                    group={currentGroup}
                    groupTab={groupTab}
                    setGroupTab={setGroupTab}
                    onBack={() => setGroupView("picker")}
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
                        activeVote={activeVote}
                        mySubmissionGameId={mySubmissionGameId}
                        myBallot={myBallot}
                        results={voteResults}
                        onCallSession={callSession}
                        onSubmitGame={submitToSession}
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
                      />
                    }
                    canEditNewness={user?.uid === currentGroup?.ownerId}
                    onTogglePlayedOverride={togglePlayedOverride}
                    settingsNode={
                      <GroupSettingsPanel
                        group={currentGroup}
                        user={user}
                        members={members}
                        myRole={myRole}
                        meta={groupSettings}
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
                  />
                ) : (
                  <div className="bg-white p-4 rounded-2xl shadow">
                    <p className="text-sm text-gray-700 mb-3">
                      No group selected. Please pick a group to continue.
                    </p>
                    <button
                      className="text-sm text-blue-700 hover:underline"
                      onClick={() => setGroupView("picker")}
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
          {/* Search */}
          <div className="mb-4">
            <input
              type="text"
              placeholder={
                activeTab === "library"
                  ? "Search library games…"
                  : "Search your collection…"
              }
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full md:max-w-md border rounded-xl px-4 py-2 text-sm"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            {(activeTab === "collection" ? collectionGames : libraryGames).map(
              (game) => (
                <GameCard
                  key={game.id}
                  game={game}
                  inCollection={myCollection.has(game.id)}
                  onOpen={() => setSelectedGame(game)}
                  onAdd={() => addToCollection(game.id)}
                  onRemove={() => removeFromCollection(game.id)}
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
      />

      {/* Game detail (works from any tab) */}
      {showGameDetail && !isGroupInlineDetail && (
        <GameDetail
          game={selectedGameFresh}
          inCollection={myCollection.has(selectedGameFresh.id)}
          myRating={myRatings.get(selectedGameFresh.id) || null}
          onBack={() => setSelectedGame(null)}
          onRate={(value) => rateGame(selectedGameFresh.id, value)}
          onAdd={() => addToCollection(selectedGameFresh.id)}
          onRemove={() => removeFromCollection(selectedGameFresh.id)}
          canEdit={user?.uid && selectedGameFresh.createdBy === user.uid}
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
              <p className="text-sm text-gray-700">
                No votes were cast, so there is no winner.
              </p>
            );
          }

          const winnerRow = scored.find((r) => r.gameId === winnerModal.winnerGameId);

          return (
            <div className="space-y-3">
              <div className="p-3 rounded-xl border bg-gray-50">
                <div className="text-sm text-gray-600">Winner</div>
                <div className="text-lg font-semibold">{winnerTitle}</div>
                {winnerRow && (
                  <div className="text-sm text-gray-700 mt-1">
                    Score:  <span className="font-semibold">{winnerRow.score.toFixed(2)}</span>
                    {winnerRow.votes ? (
                      <span className="text-gray-500"> · Votes: {winnerRow.votes}</span>
                    ) : null}
                  </div>
                )}
              </div>

              <div>
                <div className="text-sm font-semibold mb-2">Scores</div>
                {scored.length === 0 ? (
                  <p className="text-sm text-gray-600">No scored candidates.</p>
                ) : (
                  <ul className="text-sm space-y-1">
                    {scored.map((r) => (
                      <li key={r.gameId} className="flex justify-between gap-3">
                        <span className={r.gameId === winnerModal.winnerGameId ? "font-semibold" : ""}>
                          {r.title}
                        </span>
                        <span className="text-gray-700 tabular-nums">
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

      <Toast toasts={toasts} onClose={closeToast} />
    </div>
  );
}
