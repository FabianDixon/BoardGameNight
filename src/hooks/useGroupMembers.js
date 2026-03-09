// src/hooks/useGroupMembers.js
import { useEffect, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to group members list.
 * 
 * @param {Object|null} user - The authenticated user object
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Array<Object>} Array of member objects with userId
 */
export function useGroupMembers(user, currentGroupId, groupAccessReady) {
  const [members, setMembers] = useState([]);

  useEffect(() => {
    if (!user || !currentGroupId || !groupAccessReady) {
      setMembers([]);
      return;
    }

    const ref = collection(db, "groups", currentGroupId, "members");
    return onSnapshot(ref, (snap) => {
      setMembers(snap.docs.map((d) => ({ userId: d.id, ...d.data() })));
    });
  }, [user, currentGroupId, groupAccessReady]);

  return members;
}
