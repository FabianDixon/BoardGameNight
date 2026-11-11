// src/hooks/useGames.js
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, onSnapshot, orderBy, query } from "firebase/firestore";
import { db } from "../firebase";
import { readLoad, subscribeWithRetry } from "../utils/loadReliability";

const NONE = [];

/**
 * Subscribe to the global games library.
 *
 * @param {Object|null} user - The authenticated user object
 * @returns {{games: Array<Object>, ready: boolean, error: Error|null, retry: Function}}
 */
export function useGames(user) {
  const [state, setState] = useState(null);
  const subRef = useRef(null);
  const key = user?.uid || null;

  useEffect(() => {
    if (!key) return;

    const q = query(collection(db, "games"), orderBy("createdAt", "desc"));
    const stop = subscribeWithRetry((onNext, onErr) => onSnapshot(q, onNext, onErr), {
      onNext: (snapshot) => {
        setState({
          key,
          data: snapshot.docs.map((d) => ({ id: d.id, ...d.data() })),
          loaded: true,
          error: null,
        });
      },
      onError: (error) => {
        console.error("Games listener error:", error);
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
  return { games: data, ready, error, retry };
}
