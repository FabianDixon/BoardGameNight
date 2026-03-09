// src/hooks/useGroupPool.js
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to group's pool documents.
 * 
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Array<Object>} Array of pool documents with id, sorted by cycleStartedAt
 */
export function useGroupPool(currentGroupId, groupAccessReady) {
  const [poolDocs, setPoolDocs] = useState([]);

  useEffect(() => {
    if (!currentGroupId || !groupAccessReady) {
      setPoolDocs([]);
      return;
    }
  
    const ref = collection(db, "groups", currentGroupId, "pool");
  
    return onSnapshot(ref, (snap) => {
      const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));
  
      // Optional: sort, but don't depend on the field existing
      docs.sort((a, b) => {
        const ax = typeof a.cycleStartedAt === "number" ? a.cycleStartedAt : Number.MAX_SAFE_INTEGER;
        const bx = typeof b.cycleStartedAt === "number" ? b.cycleStartedAt : Number.MAX_SAFE_INTEGER;
        return ax - bx;
      });
  
      setPoolDocs(docs);
    });
  }, [currentGroupId, groupAccessReady]);

  return poolDocs;
}
