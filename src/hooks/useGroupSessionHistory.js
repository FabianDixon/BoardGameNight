// src/hooks/useGroupSessionHistory.js
import { useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to the group's session history (play records).
 * 
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Array<Object>} Array of play records ordered by playedAt DESC (newest first)
 */
export function useGroupSessionHistory(currentGroupId, groupAccessReady) {
  const [history, setHistory] = useState([]);

  useEffect(() => {
    if (!currentGroupId || !groupAccessReady) {
      setHistory([]);
      return;
    }

    const ref = collection(db, "groups", currentGroupId, "plays");
    const q = query(ref, orderBy("playedAt", "desc"));

    return onSnapshot(
      q,
      (snap) => {
        setHistory(
          snap.docs.map((d) => ({ id: d.id, ...d.data() }))
        );
      },
      (err) => {
        console.error("Failed to load session history:", err);
        setHistory([]);
      }
    );
  }, [currentGroupId, groupAccessReady]);

  return history;
}
