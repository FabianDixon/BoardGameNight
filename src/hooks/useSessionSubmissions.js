// src/hooks/useSessionSubmissions.js
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { VOTE_STATUS } from "../constants/workflow";

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
  const [state, setState] = useState(() => ({
    currentGroupId,
    activeVoteId,
    activeVoteStatus,
    groupAccessReady,
    sessionSubmissions: [],
  }));

  if (
    state.currentGroupId !== currentGroupId ||
    state.activeVoteId !== activeVoteId ||
    state.activeVoteStatus !== activeVoteStatus ||
    state.groupAccessReady !== groupAccessReady
  ) {
    setState({
      currentGroupId,
      activeVoteId,
      activeVoteStatus,
      groupAccessReady,
      sessionSubmissions: [],
    });
  }

  useEffect(() => {
    if (!currentGroupId || !activeVoteId || activeVoteStatus !== VOTE_STATUS.COLLECTING || !groupAccessReady) return;

    const ref = collection(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVoteId,
      "submissions"
    );
    let active = true;

    const unsubscribe = onSnapshot(ref, (snap) => {
      if (active) {
        setState({
          currentGroupId,
          activeVoteId,
          activeVoteStatus,
          groupAccessReady,
          sessionSubmissions: snap.docs.map((d) => ({ userId: d.id, ...d.data() })),
        });
      }
    });

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentGroupId, activeVoteId, activeVoteStatus, groupAccessReady]);

  return state.sessionSubmissions;
}
