// src/hooks/useGroupSettings.js
import { useCallback, useEffect, useRef, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";
import { subscribeWithRetry } from "../utils/loadReliability";

/**
 * Subscribe to group settings/meta document.
 * 
 * @param {Object|null} user - The authenticated user object
 * @param {string} currentGroupId - The current group ID
 * @param {boolean} groupAccessReady - Whether group access is ready
 * @returns {Object|null} Group settings object or null
 */
export function useGroupSettings(user, currentGroupId, groupAccessReady) {
  return useGroupSettingsState(user, currentGroupId, groupAccessReady).settings;
}

/**
 * Same subscription, but also reports whether the first snapshot for the
 * current group has arrived (a missing doc is "ready" with null settings).
 */
export function useGroupSettingsState(user, currentGroupId, groupAccessReady) {
  const [state, setState] = useState(INITIAL);
  const subRef = useRef(null);
  const key = user && currentGroupId && groupAccessReady ? currentGroupId : null;

  useEffect(() => {
    if (!key) return;

    const ref = doc(db, "groups", key, "settings", "meta");
    const stop = subscribeWithRetry((onNext, onErr) => onSnapshot(ref, onNext, onErr), {
      onNext: (snap) => setState({ key, settings: snap.exists() ? snap.data() : null, error: null }),
      onError: (error) => {
        console.error("Group settings listener error:", error);
        setState({ key, settings: null, error });
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
  return { settings: ready ? state.settings : null, ready, error, retry };
}

const INITIAL = { key: null, settings: null, error: null };
