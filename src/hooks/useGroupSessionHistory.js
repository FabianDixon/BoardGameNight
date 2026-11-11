// src/hooks/useGroupSessionHistory.js
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to the group's session history (play records).
 * 
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Array<Object>} Array of play records ordered by playedAt DESC (newest first)
 */
export function useGroupSessionHistory(currentGroupId, groupAccessReady) {
  const [state, setState] = useState(() => ({
    currentGroupId,
    groupAccessReady,
    history: [],
  }));

  if (
    state.currentGroupId !== currentGroupId ||
    state.groupAccessReady !== groupAccessReady
  ) {
    setState({ currentGroupId, groupAccessReady, history: [] });
  }

  useEffect(() => {
    if (!currentGroupId || !groupAccessReady) return;

    const ref = collection(db, "groups", currentGroupId, "plays");
    const q = query(ref, orderBy("playedAt", "desc"));
    let active = true;

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (active) {
          setState({
            currentGroupId,
            groupAccessReady,
            history: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          });
        }
      },
      (err) => {
        if (active) {
          console.error("Failed to load session history:", err);
          setState({ currentGroupId, groupAccessReady, history: [] });
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentGroupId, groupAccessReady]);

  return state.history;
}
