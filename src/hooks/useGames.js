// src/hooks/useGames.js
import { useEffect, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to the global games library.
 * 
 * @param {Object|null} user - The authenticated user object
 * @returns {Array<Object>} Array of game objects with id
 */
export function useGames(user) {
  const [games, setGames] = useState([]);

  useEffect(() => {
    if (!user) {
      setGames([]);
      return;
    }
  
    const q = query(collection(db, "games"), orderBy("createdAt", "desc"));
    const unsub = onSnapshot(
      q,
      (snapshot) => {
        setGames(snapshot.docs.map((d) => ({ id: d.id, ...d.data() })));
      },
      (err) => {
        console.error("Games listener error:", err);
        setGames([]);
      }
    );
  
    return unsub;
  }, [user]);

  return games;
}
