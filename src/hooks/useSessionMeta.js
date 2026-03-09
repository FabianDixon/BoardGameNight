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
  const [sessionMeta, setSessionMeta] = useState(null);

  useEffect(() => {
    if (!currentGroupId || !groupAccessReady) {
      setSessionMeta(null);
      return;
    }

    const ref = doc(db, "groups", currentGroupId, "activeSession", "meta");
    return onSnapshot(ref, (snap) => {
      setSessionMeta(snap.exists() ? { id: snap.id, ...snap.data() } : null);
    });
  }, [currentGroupId, groupAccessReady]);

  return sessionMeta;
}
