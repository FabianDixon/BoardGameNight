// src/hooks/useGroupVotes.js
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to group's votes history.
 * 
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Array<Object>} Array of vote documents with id
 */
export function useGroupVotes(currentGroupId, groupAccessReady) {
  const [state, setState] = useState(() => ({
    currentGroupId,
    groupAccessReady,
    votes: [],
  }));

  if (
    state.currentGroupId !== currentGroupId ||
    state.groupAccessReady !== groupAccessReady
  ) {
    setState({ currentGroupId, groupAccessReady, votes: [] });
  }

  useEffect(() => {
    if (!currentGroupId || !groupAccessReady) return;

    const ref = query(
      collection(db, "groups", currentGroupId, "votes"),
      orderBy("createdAt", "desc")
    );
    let active = true;

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (active) {
        setState({
          currentGroupId,
          groupAccessReady,
          votes: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
        });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentGroupId, groupAccessReady]);

  return state.votes;
}
