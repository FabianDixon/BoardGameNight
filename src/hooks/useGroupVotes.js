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
  const [votes, setVotes] = useState([]);

  useEffect(() => {
    if (!currentGroupId || !groupAccessReady) {
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
  }, [currentGroupId, groupAccessReady]);

  return votes;
}
