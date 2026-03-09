// src/hooks/useSessionSubmissions.js
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to session submissions during the collecting phase.
 * 
 * @param {string} currentGroupId - The current group ID
 * @param {string|null} activeVoteId - The active vote ID
 * @param {string|null} activeVoteStatus - The active vote status
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Array<Object>} Array of submission documents with userId
 */
export function useSessionSubmissions(currentGroupId, activeVoteId, activeVoteStatus, groupAccessReady) {
  const [sessionSubmissions, setSessionSubmissions] = useState([]);

  useEffect(() => {
    if (!currentGroupId || !activeVoteId || activeVoteStatus !== "collecting" || !groupAccessReady) {
      return;
    }

    const ref = collection(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVoteId,
      "submissions"
    );

    return onSnapshot(ref, (snap) => {
      setSessionSubmissions(
        snap.docs.map((d) => ({ userId: d.id, ...d.data() }))
      );
    });
  }, [currentGroupId, activeVoteId, activeVoteStatus, groupAccessReady]);

  return sessionSubmissions;
}
