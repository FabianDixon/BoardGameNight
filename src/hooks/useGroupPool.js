// src/hooks/useGroupPool.js
import { useCallback, useEffect, useRef, useState } from "react";
import { collection, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { subscribeWithRetry } from "../utils/loadReliability";

/**
 * Subscribe to group's pool documents.
 * 
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Array<Object>} Array of pool documents with id, sorted by cycleStartedAt
 */
export function useGroupPool(currentGroupId, groupAccessReady) {
  return useGroupPoolState(currentGroupId, groupAccessReady).poolDocs;
}

/**
 * Same subscription, but also reports whether the first pool snapshot for the
 * current group has arrived, so an unloaded pool is not mistaken for an empty one.
 */
export function useGroupPoolState(currentGroupId, groupAccessReady) {
  const [state, setState] = useState(INITIAL);
  const subRef = useRef(null);
  const key = currentGroupId && groupAccessReady ? currentGroupId : null;

  useEffect(() => {
    if (!key) return;

    const ref = collection(db, "groups", key, "pool");

    const stop = subscribeWithRetry((onNext, onErr) => onSnapshot(ref, onNext, onErr), {
      onNext: (snap) => {
        const docs = snap.docs.map((d) => ({ id: d.id, ...d.data() }));

        // Optional: sort, but don't depend on the field existing
        docs.sort((a, b) => {
          const ax = typeof a.cycleStartedAt === "number" ? a.cycleStartedAt : Number.MAX_SAFE_INTEGER;
          const bx = typeof b.cycleStartedAt === "number" ? b.cycleStartedAt : Number.MAX_SAFE_INTEGER;
          return ax - bx;
        });

        setState({ key, poolDocs: docs, error: null });
      },
      onError: (error) => {
        console.error("Group pool listener error:", error);
        setState({ key, poolDocs: [], error });
      },
    });
    subRef.current = stop;

    return () => {
      stop();
      if (subRef.current === stop) subRef.current = null;
      setState(INITIAL);
    };
  }, [key]);

  const retry = useCallback(() => subRef.current?.retry(), []);

  const matches = !!key && state.key === key;
  const error = matches ? state.error : null;
  const ready = matches && !error;
  return { poolDocs: ready ? state.poolDocs : EMPTY_POOL, ready, error, retry };
}

const EMPTY_POOL = [];
const INITIAL = { key: null, poolDocs: [], error: null };
