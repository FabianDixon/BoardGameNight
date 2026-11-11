// src/hooks/useGroupSessionHistory.js
import { useCallback, useEffect, useState } from "react";
import { collection, onSnapshot, query, orderBy } from "firebase/firestore";
import { db } from "../firebase";

/**
 * Subscribe to the group's session history (play records).
 * 
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {{history: Array<Object>, loading: boolean, error: Error|null}}
 *   Play records ordered by playedAt DESC (newest first), with subscription state.
 */
export function useGroupSessionHistoryState(currentGroupId, groupAccessReady) {
  const [retryVersion, setRetryVersion] = useState(0);
  const [state, setState] = useState(() => ({
    currentGroupId,
    groupAccessReady,
    history: [],
    loading: Boolean(currentGroupId),
    error: null,
  }));
  const retry = useCallback(() => {
    setState({
      currentGroupId,
      groupAccessReady,
      history: [],
      loading: Boolean(currentGroupId),
      error: null,
    });
    setRetryVersion((version) => version + 1);
  }, [currentGroupId, groupAccessReady]);

  if (
    state.currentGroupId !== currentGroupId ||
    state.groupAccessReady !== groupAccessReady
  ) {
    setState({
      currentGroupId,
      groupAccessReady,
      history: [],
      loading: Boolean(currentGroupId),
      error: null,
    });
  }

  useEffect(() => {
    if (!currentGroupId || !groupAccessReady) return;

    const ref = collection(db, "groups", currentGroupId, "plays");
    const q = query(ref, orderBy("playedAt", "desc"));
    let active = true;

    const unsubscribe = onSnapshot(
      q,
      (snap) => {
        if (active) {
          setState({
            currentGroupId,
            groupAccessReady,
            history: snap.docs.map((d) => ({ id: d.id, ...d.data() })),
            loading: false,
            error: null,
          });
        }
      },
      (err) => {
        if (active) {
          console.error("Failed to load session history:", err);
          setState({
            currentGroupId,
            groupAccessReady,
            history: [],
            loading: false,
            error: err,
          });
        }
      }
    );

    return () => {
      active = false;
      unsubscribe();
    };
  }, [currentGroupId, groupAccessReady, retryVersion]);

  if (state.currentGroupId !== currentGroupId) {
    return {
      history: [],
      loading: Boolean(currentGroupId),
      error: null,
      retry,
    };
  }
  return {
    history: state.history,
    loading: state.loading,
    error: state.error,
    retry,
  };
}

export function useGroupSessionHistory(currentGroupId, groupAccessReady) {
  return useGroupSessionHistoryState(currentGroupId, groupAccessReady).history;
}
