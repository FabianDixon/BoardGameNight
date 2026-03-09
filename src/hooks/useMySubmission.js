// src/hooks/useMySubmission.js
import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to the current user's submission for the active vote.
 * 
 * @param {string|null} userId - The current user's ID
 * @param {string} currentGroupId - The current group ID
 * @param {string|null} activeVoteId - The active vote ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Object|null} Submission data: { gameId: string|null, isNoSubmission: boolean, exists: boolean }
 */
export function useMySubmission(userId, currentGroupId, activeVoteId, groupAccessReady) {
  const [mySubmission, setMySubmission] = useState(null);

  useEffect(() => {
    if (!userId || !currentGroupId || !activeVoteId || !groupAccessReady) {
      setMySubmission(null);
      return;
    }

    const ref = doc(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVoteId,
      "submissions",
      userId
    );

    return onSnapshot(ref, (snap) => {
      if (!snap.exists()) {
        setMySubmission(null);
        return;
      }
      
      const data = snap.data();
      setMySubmission({
        gameId: data?.gameId ?? null,
        isNoSubmission: data?.isNoSubmission === true,
        exists: true,
        submittedAt: data?.submittedAt ?? null,
      });
    });
  }, [userId, currentGroupId, activeVoteId, groupAccessReady]);

  return mySubmission;
}
