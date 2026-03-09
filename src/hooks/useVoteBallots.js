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
  const [myBallot, setMyBallot] = useState(null);
  const [voteBallots, setVoteBallots] = useState([]);

  useEffect(() => {
    if (!user || !currentGroupId || !activeVoteId || !groupAccessReady) {
      setMyBallot(null);
      setVoteBallots([]);
      return;
    }

    const myRef = doc(
      db,
      "groups",
      currentGroupId,
      "votes",
      activeVoteId,
      "ballots",
      user.uid
    );

    const unsubMy = onSnapshot(myRef, (snap) => {
      setMyBallot(snap.exists() ? snap.data() : null);
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
      setVoteBallots(snap.docs.map((d) => ({ userId: d.id, ...d.data() })));
    });

    return () => {
      unsubMy();
      unsubAll();
    };
  }, [user, currentGroupId, activeVoteId, groupAccessReady]);

  return { myBallot, voteBallots };
}
