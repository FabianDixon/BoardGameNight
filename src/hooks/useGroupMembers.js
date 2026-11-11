// src/hooks/useGroupMembers.js
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { readLoad, subscribeWithRetry } from "../utils/loadReliability";

const NONE = [];

/**
 * Subscribe to group members list.
 *
 * @param {Object|null} user - The authenticated user object
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {{members: Array<Object>, ready: boolean, error: Error|null, retry: Function}}
 *   `ready` is true only after the first snapshot for the current user/group.
 */
export function useGroupMembers(user, currentGroupId, groupAccessReady) {
  const [state, setState] = useState(null);
  const subRef = useRef(null);
  const uid = user?.uid;
  const active = !!uid && !!currentGroupId && !!groupAccessReady;
  const key = active ? `${uid}:${currentGroupId}` : null;

  useEffect(() => {
    if (!key) return;

    const ref = collection(db, "groups", currentGroupId, "members");
    const stop = subscribeWithRetry((onNext, onErr) => onSnapshot(ref, onNext, onErr), {
      onNext: (snap) => {
        setState({
          key,
          data: snap.docs.map((d) => ({ userId: d.id, ...d.data() })),
          loaded: true,
          error: null,
        });
      },
      onError: (error) => {
        console.error("Group members listener error:", error);
        setState({ key, data: null, loaded: false, error });
      },
    });
    subRef.current = stop;

    return () => {
      stop();
      if (subRef.current === stop) subRef.current = null;
      setState(null);
    };
  }, [key, currentGroupId]);

  const retry = useCallback(() => subRef.current?.retry(), []);
  const { data, ready, error } = readLoad(state, key, NONE);
  return { members: data, ready, error, retry };
}
