// src/hooks/useMyRatings.js
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to the current user's game ratings.
 * 
 * @param {Object|null} user - The authenticated user object
 * @returns {Map<string, number>} Map of gameId -> rating value
 */
export function useMyRatings(user) {
  const [myRatings, setMyRatings] = useState(new Map());

  useEffect(() => {
    if (!user) return;

    const q = query(
      collection(db, "ratings"),
      where("userId", "==", user.uid)
    );

    const unsub = onSnapshot(q, (snap) => {
      const map = new Map();
      snap.forEach((d) => {
        map.set(d.data().gameId, d.data().value);
      });
      setMyRatings(map);
    });

    return unsub;
  }, [user]);

  return myRatings;
}
