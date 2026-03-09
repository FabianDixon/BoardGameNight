// src/hooks/useGroupSettings.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to group settings/meta document.
 * 
 * @param {Object|null} user - The authenticated user object
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Object|null} Group settings object or null
 */
export function useGroupSettings(user, currentGroupId, groupAccessReady) {
  const [groupSettings, setGroupSettings] = useState(null);

  useEffect(() => {
    if (!user || !currentGroupId || !groupAccessReady) {
      setGroupSettings(null);
      return;
    }

    const ref = doc(db, "groups", currentGroupId, "settings", "meta");
    return onSnapshot(ref, (snap) => {
      setGroupSettings(snap.exists() ? snap.data() : null);
    });
  }, [user, currentGroupId, groupAccessReady]);

  return groupSettings;
}
