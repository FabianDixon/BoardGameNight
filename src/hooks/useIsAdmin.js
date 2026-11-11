import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * useIsAdmin - React hook to check if the current user is an admin.
 * @param {string | undefined | null} userId - The current user's UID
 * @returns {{ isAdmin: boolean, loadingAdmin: boolean }}
 */
export default function useIsAdmin(userId) {
  const [state, setState] = useState(() => ({
    userId,
    isAdmin: false,
    loadingAdmin: !!userId,
  }));

  if (state.userId !== userId) {
    setState({ userId, isAdmin: false, loadingAdmin: !!userId });
  }

  useEffect(() => {
    if (!userId) return;

    const ref = doc(db, "admins", userId);
    let active = true;
    const unsub = onSnapshot(
      ref,
      (snap) => {
        if (active) {
          setState({
            userId,
            isAdmin: !!snap.exists() && snap.data()?.isAdmin === true,
            loadingAdmin: false,
          });
        }
      },
      () => {
        if (active) setState({ userId, isAdmin: false, loadingAdmin: false });
      }
    );

    return () => {
      active = false;
      unsub();
    };
  }, [userId]);

  return { isAdmin: state.isAdmin, loadingAdmin: state.loadingAdmin };
}
