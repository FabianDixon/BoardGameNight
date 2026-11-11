// src/hooks/useMyCollection.js
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { readLoad, subscribeWithRetry } from "../utils/loadReliability";

/**
 * Subscribe to the current user's personal game collection.
 *
 * @param {Object|null} user - The authenticated user object
 * @returns {{myCollection: Set<string>, ready: boolean, error: Error|null, retry: Function}}
 *   `ready` is true only after the first snapshot for the current user.
 */
export function useMyCollection(user) {
  const [state, setState] = useState(null);
  const subRef = useRef(null);
  const key = user?.uid || null;

  useEffect(() => {
    if (!key) return;

    const colRef = collection(db, "users", key, "collection");
    const stop = subscribeWithRetry((onNext, onErr) => onSnapshot(colRef, onNext, onErr), {
      onNext: (snap) => {
        setState({
          key,
          data: new Set(
            snap.docs.map((d) => d.data()?.gameId || d.id).filter(Boolean)
          ),
          loaded: true,
          error: null,
        });
      },
      onError: (error) => {
        console.error("Collection listener error:", error);
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
  const empty = useMemo(() => new Set(), []);
  const { data, ready, error } = readLoad(state, key, empty);
  return { myCollection: data, ready, error, retry };
}
