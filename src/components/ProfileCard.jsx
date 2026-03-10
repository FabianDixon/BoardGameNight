// src/components/ProfileCard.jsx
import { useMemo, useState } from "react";
import {
  EmailAuthProvider,
  getAuth,
  linkWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";

export default function ProfileCard({
  user,
  profile,
  nickname,
  setNickname,
  onSaveNickname,
}) {
  const auth = useMemo(() => getAuth(), []);

  // Start in signin mode if localStorage indicates the user came from landing page signin button
  const defaultMode = typeof window !== 'undefined' && localStorage.getItem("bgng_auth_choice") === "signin" ? "signin" : "link";
  const [mode, setMode] = useState(defaultMode); // "link" | "signin"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" }); // type: "success" | "error" | "info"

  const isAnonymous = !!user?.isAnonymous;

  function setError(text) {
    setMsg({ type: "error", text });
  }

  function setSuccess(text) {
    setMsg({ type: "success", text });
  }

  function clearMsg() {
    setMsg({ type: "", text: "" });
  }

  async function handleLinkEmailPassword() {
    clearMsg();

    const e = email.trim();
    const p = password;

    if (!e) return setError("Please enter an email.");
    if (!p || p.length < 6) return setError("Password must be at least 6 characters.");
    if (!user) return setError("Signing in… try again in a second.");

    setBusy(true);
    try {
      const cred = EmailAuthProvider.credential(e, p);
      await linkWithCredential(user, cred);

      setSuccess("Account saved! You can now sign in with email/password.");
      setPassword("");
    } catch (err) {
      const code = err?.code || "";

      if (code === "auth/email-already-in-use") {
        setError("That email is already in use. Use Sign in instead.");
        setMode("signin");
      } else if (code === "auth/invalid-email") {
        setError("That email looks invalid.");
      } else if (code === "auth/weak-password") {
        setError("Weak password. Use at least 6 characters.");
      } else if (code === "auth/provider-already-linked") {
        setError("This account is already linked.");
      } else if (code === "auth/credential-already-in-use") {
        setError("Those credentials are linked to another account.");
      } else {
        setError("Could not Create account. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignIn() {
    clearMsg();

    const e = email.trim();
    const p = password;

    if (!e) return setError("Please enter your email.");
    if (!p) return setError("Please enter your password.");

    setBusy(true);
    try {
      await signInWithEmailAndPassword(auth, e, p);
      setSuccess("Signed in ✅");
      setPassword("");
    } catch (err) {
      const code = err?.code || "";
      if (code === "auth/user-not-found" || code === "auth/wrong-password") {
        setError("Wrong email or password.");
      } else if (code === "auth/invalid-email") {
        setError("That email looks invalid.");
      } else {
        setError("Sign in failed. Please try again.");
      }
    } finally {
      setBusy(false);
    }
  }

  async function handleSignOut() {
    clearMsg();
    setBusy(true);
    try {
      await signOut(auth);
      setSuccess("Signed out.");
    } catch (err) {
      setError("Sign out failed.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <div className="bg-neutral-800 p-4 rounded-2xl shadow border border-neutral-700">
      <h2 className="text-xl font-semibold mb-3 text-white">Profile</h2>

      {!user ? (
        <p className="text-sm text-gray-300">Signing in…</p>
      ) : !profile ? (
        <p className="text-sm text-gray-300">Loading profile…</p>
      ) : (
        <>
          {/* Nickname */}
          <p className="text-sm text-gray-300 mb-2">
            Current nickname:{" "}
            <span className="font-semibold">
              {profile.nickname || "(no nickname yet)"}
            </span>
          </p>

          <div className="mb-4">
            <input
              className="border border-neutral-700 p-2 rounded w-full mb-2 bg-neutral-900 text-white placeholder-gray-400"
              placeholder="Enter nickname"
              value={nickname}
              onChange={(e) => setNickname(e.target.value)}
            />
            <button
              className="bg-blue-600 text-white px-4 py-2 rounded"
              onClick={onSaveNickname}
              disabled={!nickname.trim()}
              title={!nickname.trim() ? "Enter a nickname first" : ""}
            >
              Save nickname
            </button>
          </div>

          <hr className="my-4 border-neutral-700" />

          {/* Account section */}
          <div className="flex items-center justify-between mb-2">
            <h3 className="text-lg font-semibold text-white">Account</h3>

            {!isAnonymous && (
              <button
                className="text-sm text-red-400 hover:underline"
                onClick={handleSignOut}
                disabled={busy}
              >
                Sign out
              </button>
            )}
          </div>

          {!isAnonymous ? (
            <p className="text-sm text-gray-300">
              Your account is secured.
              {user.email ? (
                <>
                  {" "}
                  Signed in as <span className="font-semibold">{user.email}</span>.
                </>
              ) : null}
            </p>
          ) : (
            <>
              <p className="text-sm text-gray-300 mb-3">
                You’re using a temporary account. Save it so you can sign in again on other devices.
              </p>

              {/* Mode toggle */}
              <div className="flex gap-2 mb-3">
                <button
                  className={`px-3 py-2 rounded border border-neutral-700 text-white ${
                    mode === "link" ? "bg-neutral-700" : "bg-neutral-900 hover:bg-neutral-800"
                  }`}
                  onClick={() => {
                    clearMsg();
                    setMode("link");
                  }}
                  disabled={busy}
                >
                  Create account
                </button>

                <button
                  className={`px-3 py-2 rounded border border-neutral-700 text-white ${
                    mode === "signin" ? "bg-neutral-700" : "bg-neutral-900 hover:bg-neutral-800"
                  }`}
                  onClick={() => {
                    clearMsg();
                    setMode("signin");
                  }}
                  disabled={busy}
                >
                  Sign in
                </button>
              </div>

              {/* Inputs */}
              <input
                className="border border-neutral-700 p-2 rounded w-full mb-2 bg-neutral-900 text-white placeholder-gray-400"
                placeholder="Email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                autoComplete="email"
                disabled={busy}
              />

              <input
                className="border border-neutral-700 p-2 rounded w-full mb-2 bg-neutral-900 text-white placeholder-gray-400"
                placeholder={mode === "signin" ? "Password" : "Password (min 6 chars)"}
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete={mode === "signin" ? "current-password" : "new-password"}
                disabled={busy}
              />

              {msg.text && (
                <p
                  className={`text-sm mb-2 ${
                    msg.type === "error"
                      ? "text-red-400"
                      : msg.type === "success"
                      ? "text-green-400"
                      : "text-gray-300"
                  }`}
                >
                  {msg.text}
                </p>
              )}

              {mode === "link" ? (
                <button
                  className="bg-gray-900 text-white px-4 py-2 rounded"
                  onClick={handleLinkEmailPassword}
                  disabled={busy}
                >
                  {busy ? "Saving…" : "Create"}
                </button>
              ) : (
                <button
                  className="bg-gray-900 text-white px-4 py-2 rounded"
                  onClick={handleSignIn}
                  disabled={busy}
                >
                  {busy ? "Signing in…" : "Sign in"}
                </button>
              )}
            </>
          )}
        </>
      )}
    </div>
  );
}