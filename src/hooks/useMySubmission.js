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
 * @returns {string|null} The submitted game ID or null
 */
export function useMySubmission(userId, currentGroupId, activeVoteId, groupAccessReady) {
  const [mySubmissionGameId, setMySubmissionGameId] = useState(null);

  useEffect(() => {
    if (!userId || !currentGroupId || !activeVoteId || !groupAccessReady) {
      setMySubmissionGameId(null);
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
      setMySubmissionGameId(snap.exists() ? snap.data()?.gameId ?? null : null);
    });
  }, [userId, currentGroupId, activeVoteId, groupAccessReady]);

  return mySubmissionGameId;
}
