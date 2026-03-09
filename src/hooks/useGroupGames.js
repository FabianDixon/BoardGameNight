// src/hooks/useGroupGames.js
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to group's materialized game collection.
 * 
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Array<Object>} Array of group game refs with id, ownersCount, etc.
 */
export function useGroupGames(currentGroupId, groupAccessReady) {
  const [groupGameRefs, setGroupGameRefs] = useState([]);

  useEffect(() => {
    if (!currentGroupId || !groupAccessReady) {
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
  }, [currentGroupId, groupAccessReady]);

  return groupGameRefs;
}
