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
  const [groupWeightOverrides, setGroupWeightOverrides] = useState(null);

  useEffect(() => {
    if (!currentGroupId || !groupAccessReady) {
      setGroupWeightOverrides(null);
      return;
    }
    const ref = doc(db, "groups", currentGroupId, "settings", "weights");
    return onSnapshot(ref, (snap) => {
      setGroupWeightOverrides(snap.exists() ? snap.data() : null);
    });
  }, [currentGroupId, groupAccessReady]);

  return groupWeightOverrides;
}
