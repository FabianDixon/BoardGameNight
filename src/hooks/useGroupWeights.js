// src/hooks/useGroupWeights.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to group weight overrides.
 * 
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Object|null} Weight overrides object or null
 */
export function useGroupWeights(currentGroupId, groupAccessReady) {
  const [state, setState] = useState(() => ({
    currentGroupId,
    groupAccessReady,
    groupWeightOverrides: null,
  }));

  if (
    state.currentGroupId !== currentGroupId ||
    state.groupAccessReady !== groupAccessReady
  ) {
    setState({ currentGroupId, groupAccessReady, groupWeightOverrides: null });
  }

  useEffect(() => {
    if (!currentGroupId || !groupAccessReady) return;

    const ref = doc(db, "groups", currentGroupId, "settings", "weights");
    let active = true;
    const unsubscribe = onSnapshot(ref, (snap) => {
      if (active) {
        setState({
          currentGroupId,
          groupAccessReady,
          groupWeightOverrides: snap.exists() ? snap.data() : null,
        });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentGroupId, groupAccessReady]);

  return state.groupWeightOverrides;
}
