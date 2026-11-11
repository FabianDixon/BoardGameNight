// src/hooks/useGroupGames.js
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { readLoad, subscribeWithRetry } from "../utils/loadReliability";

const NONE = [];

/**
 * Subscribe to group's materialized game collection.
 *
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {{groupGameRefs: Array<Object>, ready: boolean, error: Error|null, retry: Function}}
 *   `ready` is true only after the first snapshot for the current group.
 */
export function useGroupGames(currentGroupId, groupAccessReady) {
  const [state, setState] = useState(null);
  const subRef = useRef(null);
  const key = currentGroupId && groupAccessReady ? currentGroupId : null;

  useEffect(() => {
    if (!key) return;

    const ref = query(
      collection(db, "groups", key, "games"),
      orderBy("ownersCount", "desc")
    );

    const stop = subscribeWithRetry((onNext, onErr) => onSnapshot(ref, onNext, onErr), {
      onNext: (snap) => {
        setState({
          key,
          data: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
          loaded: true,
          error: null,
        });
      },
      onError: (error) => {
        console.error("Group games listener error:", error);
        setState({ key, data: null, loaded: false, error });
      },
    });
    subRef.current = stop;

    return () => {
      stop();
      if (subRef.current === stop) subRef.current = null;
      setState(null);
    };
  }, [key]);

  const retry = useCallback(() => subRef.current?.retry(), []);
  const { data, ready, error } = readLoad(state, key, NONE);
  return { groupGameRefs: data, ready, error, retry };
}
