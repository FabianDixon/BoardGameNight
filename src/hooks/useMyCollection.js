// src/hooks/useMyCollection.js
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to the current user's personal game collection.
 * 
 * @param {Object|null} user - The authenticated user object
 * @returns {Set<string>} Set of game IDs in the user's collection
 */
export function useMyCollection(user) {
  const [myCollection, setMyCollection] = useState(new Set());

  useEffect(() => {
    if (!user) return;

    const colRef = collection(db, "users", user.uid, "collection");
    const unsub = onSnapshot(colRef, (snap) => {
      setMyCollection(
        new Set(
          snap.docs.map((d) => d.data()?.gameId || d.id).filter(Boolean)
        )
      );
    });

    return unsub;
  }, [user]);

  return myCollection;
}
