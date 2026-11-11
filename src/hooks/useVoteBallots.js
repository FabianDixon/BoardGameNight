// src/hooks/useVoteBallots.js
import { useEffect, useState } from "react";
import { collection, doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to ballots for the active vote.
 * Returns both the current user's ballot and all ballots.
 * 
 * @param {Object|null} user - The authenticated user object
 * @param {string} currentGroupId - The current group ID
 * @param {string|null} activeVoteId - The active vote ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {{myBallot: Object|null, voteBallots: Array<Object>}} Ballot data
 */
export function useVoteBallots(user, currentGroupId, activeVoteId, groupAccessReady) {
  const [state, setState] = useState(() => ({
    user,
    currentGroupId,
    activeVoteId,
    groupAccessReady,
    myBallot: null,
    voteBallots: [],
  }));

  if (
    state.user !== user ||
    state.currentGroupId !== currentGroupId ||
    state.activeVoteId !== activeVoteId ||
    state.groupAccessReady !== groupAccessReady
  ) {
    setState({
      user,
      currentGroupId,
      activeVoteId,
      groupAccessReady,
      myBallot: null,
      voteBallots: [],
    });
  }

  useEffect(() => {
    if (!user || !currentGroupId || !activeVoteId || !groupAccessReady) return;

    const myRef = doc(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVoteId,
      "ballots",
      user.uid
    );

    let active = true;
    const unsubMy = onSnapshot(myRef, (snap) => {
      if (active) {
        setState((current) => {
          if (
            current.user !== user ||
            current.currentGroupId !== currentGroupId ||
            current.activeVoteId !== activeVoteId ||
            current.groupAccessReady !== groupAccessReady
          ) {
            return current;
          }

          return { ...current, myBallot: snap.exists() ? snap.data() : null };
        });
      }
    });

    const allRef = collection(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVoteId,
      "ballots"
    );

    const unsubAll = onSnapshot(allRef, (snap) => {
      if (active) {
        setState((current) => {
          if (
            current.user !== user ||
            current.currentGroupId !== currentGroupId ||
            current.activeVoteId !== activeVoteId ||
            current.groupAccessReady !== groupAccessReady
          ) {
            return current;
          }

          return {
            ...current,
            voteBallots: snap.docs.map((d) => ({ userId: d.id, ...d.data() })),
          };
        });
      }
    });

    return () => {
      active = false;
      unsubMy();
      unsubAll();
    };
  }, [user, currentGroupId, activeVoteId, groupAccessReady]);

  return { myBallot: state.myBallot, voteBallots: state.voteBallots };
}
