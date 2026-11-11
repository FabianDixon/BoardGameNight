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
  const [state, setState] = useState(() => ({
    userId,
    currentGroupId,
    activeVoteId,
    groupAccessReady,
    mySubmission: null,
  }));

  if (
    state.userId !== userId ||
    state.currentGroupId !== currentGroupId ||
    state.activeVoteId !== activeVoteId ||
    state.groupAccessReady !== groupAccessReady
  ) {
    setState({
      userId,
      currentGroupId,
      activeVoteId,
      groupAccessReady,
      mySubmission: null,
    });
  }

  useEffect(() => {
    if (!userId || !currentGroupId || !activeVoteId || !groupAccessReady) return;

    const ref = doc(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVoteId,
      "submissions",
      userId
    );
    let active = true;

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (!active) return;

      if (!snap.exists()) {
        setState({
          userId,
          currentGroupId,
          activeVoteId,
          groupAccessReady,
          mySubmission: null,
        });
        return;
      }
      
      const data = snap.data();
      setState({
        userId,
        currentGroupId,
        activeVoteId,
        groupAccessReady,
        mySubmission: {
          gameId: data?.gameId ?? null,
          isNoSubmission: data?.isNoSubmission === true,
          exists: true,
          submittedAt: data?.submittedAt ?? null,
        },
      });
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [userId, currentGroupId, activeVoteId, groupAccessReady]);

  return state.mySubmission;
}
