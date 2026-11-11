// src/hooks/useSessionMeta.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to the active session metadata.
 * 
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Object|null} Session metadata with id or null
 */
export function useSessionMeta(currentGroupId, groupAccessReady) {
  const [state, setState] = useState(() => ({
    currentGroupId,
    groupAccessReady,
    sessionMeta: null,
  }));

  if (
    state.currentGroupId !== currentGroupId ||
    state.groupAccessReady !== groupAccessReady
  ) {
    setState({ currentGroupId, groupAccessReady, sessionMeta: null });
  }

  useEffect(() => {
    if (!currentGroupId || !groupAccessReady) return;

    const ref = doc(db, "groups", currentGroupId, "activeSession", "meta");
    let active = true;
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (active) {
        setState({
          currentGroupId,
          groupAccessReady,
          sessionMeta: snap.exists() ? { id: snap.id, ...snap.data() } : null,
        });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentGroupId, groupAccessReady]);

  return state.sessionMeta;
}
