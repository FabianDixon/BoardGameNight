import { useEffect, useState } from "react";
import { doc, onSnapshot } from "firebase/firestore";
import { db } from "../firebase";

/**
 * useIsAdmin - React hook to check if the current user is an admin.
 * @param {string | undefined | null} userId - The current user's UID
 * @returns {{ isAdmin: boolean, loadingAdmin: boolean }}
 */
export default function useIsAdmin(userId) {
  const [isAdmin, setIsAdmin] = useState(false);
  const [loadingAdmin, setLoadingAdmin] = useState(!!userId);

  useEffect(() => {
    if (!userId) {
      setIsAdmin(false);
      setLoadingAdmin(false);
      return;
    }
    setLoadingAdmin(true);
    const ref = doc(db, "admins", userId);
    const unsub = onSnapshot(
      ref,
      (snap) => {
        setIsAdmin(!!snap.exists() && snap.data()?.isAdmin === true);
        setLoadingAdmin(false);
      },
      () => {
        setIsAdmin(false);
        setLoadingAdmin(false);
      }
    );
    return () => unsub();
  }, [userId]);

  return { isAdmin, loadingAdmin };
}
