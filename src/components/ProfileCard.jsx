// src/components/ProfileCard.jsx
import { useMemo, useState } from "react";
import {
  EmailAuthProvider,
  getAuth,
  linkWithCredential,
  signInWithEmailAndPassword,
  signOut,
} from "firebase/auth";
import {
  DEFAULT_AVATARS,
  DEFAULT_AVATAR_ID,
  avatarById,
  avatarIconById,
} from "../constants/avatars";

export default function ProfileCard({
  user,
  profile,
  nickname,
  setNickname,
  onSaveNickname,
  onSaveAvatarId,
  onToast,
}) {
  const auth = useMemo(() => getAuth(), []);

  // Start in signin mode if localStorage indicates the user came from landing page signin button
  const defaultMode = typeof window !== 'undefined' && localStorage.getItem("bgng_auth_choice") === "signin" ? "signin" : "link";
  const [mode, setMode] = useState(defaultMode); // "link" | "signin"
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [avatarPickerOpen, setAvatarPickerOpen] = useState(false);
  const [failedAvatarSrcs, setFailedAvatarSrcs] = useState(() => new Set());

  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState({ type: "", text: "" }); // type: "success" | "error" | "info"

  const isAnonymous = !!user?.isAnonymous;
  const selectedAvatarId = profile?.avatarId || DEFAULT_AVATAR_ID;
  const selectedAvatar = avatarById(selectedAvatarId);
  const selectedAvatarIcon = avatarIconById(selectedAvatarId);
  const selectedAvatarSrc = selectedAvatar?.src || null;
  const canRenderSelectedAvatarImage =
    !!selectedAvatarSrc && !failedAvatarSrcs.has(selectedAvatarSrc);

  function setError(text) {
    setMsg({ type: "error", text });
  }

  function setSuccess(text) {
    setMsg({ type: "success", text });
  }

  function clearMsg() {
    setMsg({ type: "", text: "" });
  }

  function markAvatarSrcFailed(src) {
    const key = String(src || "").trim();
    if (!key) return;

    setFailedAvatarSrcs((prev) => {
      if (prev.has(key)) return prev;
      const next = new Set(prev);
      next.add(key);
      return next;
    });
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
    } catch {
      setError("Sign out failed.");
    } finally {
      setBusy(false);
    }
  }

  async function copyUserId() {
    const userId = String(user?.uid || "").trim();
    if (!userId) {
      onToast?.("User ID is not available yet.", "error");
      return;
    }

    try {
      await navigator.clipboard.writeText(userId);
      onToast?.("User ID copied.", "success");
    } catch {
      onToast?.("Could not copy user ID.", "error");
    }
  }

  return (
    <div className="space-y-4 pt-2 md:pt-3">
      <div className="ui-surface p-5 md:p-6">
        <div className="flex items-start gap-4">
          <div className="h-16 w-16 overflow-hidden rounded-2xl border border-neutral-600 bg-neutral-900 flex items-center justify-center text-2xl">
            {canRenderSelectedAvatarImage ? (
              <img
                src={selectedAvatarSrc}
                alt={selectedAvatar?.label || "Selected avatar"}
                className="h-full w-full object-cover"
                onError={() => markAvatarSrcFailed(selectedAvatarSrc)}
              />
            ) : (
              selectedAvatarIcon
            )}
          </div>

          <div className="min-w-0 flex-1">
            <h2 className="text-2xl md:text-3xl font-bold text-white">Profile</h2>

            {!user ? (
              <p className="mt-2 text-sm text-neutral-400">Signing in…</p>
            ) : !profile ? (
              <p className="mt-2 text-sm text-neutral-400">Loading profile…</p>
            ) : (
              <div className="mt-2">
                <p className="text-xs uppercase tracking-wide text-neutral-500">Current nickname</p>
                <p className="text-lg font-semibold text-white truncate">
                  {profile.nickname || "No nickname set"}
                </p>
                <div className="mt-1 flex items-center gap-2 min-w-0">
                  <p className="text-xs text-neutral-500 truncate">User ID: {user?.uid || "—"}</p>
                  <button
                    type="button"
                    className="ui-btn-secondary text-[11px] px-2 py-0.5 shrink-0"
                    onClick={copyUserId}
                    disabled={!user?.uid}
                  >
                    Copy
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {user && profile && (
        <>
          <div className="ui-surface p-5 md:p-6 space-y-4">
            <div>
              <h3 className="text-lg font-semibold text-white">Identity</h3>
              <p className="text-sm text-neutral-400 mt-1">Choose the nickname shown across your game nights.</p>
            </div>

            <div className="ui-surface-subtle p-4 space-y-3">
              <label className="ui-field-label">Nickname</label>
              <input
                className="w-full py-2.5"
                placeholder="Enter nickname"
                value={nickname}
                onChange={(e) => setNickname(e.target.value)}
              />

              <div className="flex items-center justify-between gap-3">
                <p className="text-sm text-neutral-400 min-w-0 truncate">
                  Current: <span className="font-semibold text-neutral-200">{profile.nickname || "(no nickname yet)"}</span>
                </p>
                <button
                  className="ui-btn-primary text-sm"
                  onClick={onSaveNickname}
                  disabled={!nickname.trim()}
                  title={!nickname.trim() ? "Enter a nickname first" : ""}
                >
                  Save nickname
                </button>
              </div>
            </div>

            <div className="ui-surface-subtle p-4 space-y-3">
              <div>
                <label className="ui-field-label">Avatar</label>
                <p className="ui-field-hint">Choose from default avatars.</p>
              </div>

              <div className="flex items-center justify-between gap-3 rounded-xl border border-neutral-700 bg-neutral-900 px-3 py-2.5">
                <div className="flex items-center gap-3 min-w-0">
                  <div className="h-11 w-11 overflow-hidden rounded-xl border border-neutral-700 bg-neutral-800 flex items-center justify-center text-2xl shrink-0">
                    {canRenderSelectedAvatarImage ? (
                      <img
                        src={selectedAvatarSrc}
                        alt={selectedAvatar?.label || "Selected avatar"}
                        className="h-full w-full object-cover"
                        onError={() => markAvatarSrcFailed(selectedAvatarSrc)}
                      />
                    ) : (
                      selectedAvatarIcon
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-white truncate">
                      {selectedAvatar?.label || "Default avatar"}
                    </div>
                    <div className="text-xs text-neutral-400">{selectedAvatarId}</div>
                  </div>
                </div>

                <button
                  type="button"
                  className="ui-btn-secondary text-xs px-3 py-1.5"
                  onClick={() => setAvatarPickerOpen(true)}
                >
                  Change avatar
                </button>
              </div>
            </div>
          </div>

          <div className="ui-surface p-5 md:p-6 space-y-4">
            <div className="flex items-start justify-between gap-3">
              <div>
                <h3 className="text-lg font-semibold text-white">Account</h3>
                <p className="text-sm text-neutral-400 mt-1">Manage how you sign in and secure this profile.</p>
              </div>

              {!isAnonymous && (
                <button
                  className="ui-btn-danger text-xs"
                  onClick={handleSignOut}
                  disabled={busy}
                >
                  Sign out
                </button>
              )}
            </div>

            {!isAnonymous ? (
              <div className="ui-surface-subtle p-4">
                <div className="flex flex-wrap items-center gap-2 mb-2">
                  <span className="ui-chip-green">Secured account</span>
                </div>
                <p className="text-sm text-neutral-300">
                  Your account is secured.
                  {user.email ? (
                    <>
                      {" "}
                      Signed in as <span className="font-semibold text-white">{user.email}</span>.
                    </>
                  ) : null}
                </p>
              </div>
            ) : (
              <div className="space-y-4">
                <div className="ui-surface-subtle p-4">
                  <div className="flex flex-wrap items-center gap-2 mb-2">
                    <span className="ui-chip-yellow">Temporary account</span>
                  </div>
                  <p className="text-sm text-neutral-300">
                    You’re using a temporary account. Save it so you can sign in again on other devices.
                  </p>
                </div>

                <div className="ui-surface-subtle p-4 space-y-3">
                  <div className="ui-segmented">
                    <button
                      className={`ui-segment ${mode === "link" ? "ui-pill-active" : "ui-pill-inactive"}`}
                      onClick={() => {
                        clearMsg();
                        setMode("link");
                      }}
                      disabled={busy}
                    >
                      Create account
                    </button>

                    <button
                      className={`ui-segment ${mode === "signin" ? "ui-pill-active" : "ui-pill-inactive"}`}
                      onClick={() => {
                        clearMsg();
                        setMode("signin");
                      }}
                      disabled={busy}
                    >
                      Sign in
                    </button>
                  </div>

                  <div className="space-y-2">
                    <input
                      className="py-2.5"
                      placeholder="Email"
                      value={email}
                      onChange={(e) => setEmail(e.target.value)}
                      autoComplete="email"
                      disabled={busy}
                    />

                    <input
                      className="py-2.5"
                      placeholder={mode === "signin" ? "Password" : "Password (min 6 chars)"}
                      type="password"
                      value={password}
                      onChange={(e) => setPassword(e.target.value)}
                      autoComplete={mode === "signin" ? "current-password" : "new-password"}
                      disabled={busy}
                    />
                  </div>

                  {msg.text && (
                    <p
                      className={`text-sm ${
                        msg.type === "error"
                          ? "text-red-400"
                          : msg.type === "success"
                          ? "text-emerald-300"
                          : "text-neutral-300"
                      }`}
                    >
                      {msg.text}
                    </p>
                  )}

                  {mode === "link" ? (
                    <button
                      className="ui-btn-primary px-3 py-1.5 text-sm"
                      onClick={handleLinkEmailPassword}
                      disabled={busy}
                    >
                      {busy ? "Saving…" : "Create"}
                    </button>
                  ) : (
                    <button
                      className="ui-btn-primary px-3 py-1.5 text-sm"
                      onClick={handleSignIn}
                      disabled={busy}
                    >
                      {busy ? "Signing in…" : "Sign in"}
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        </>
      )}

      {avatarPickerOpen && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center p-4"
          role="dialog"
          aria-modal="true"
        >
          <div
            className="ui-modal-backdrop"
            onClick={() => setAvatarPickerOpen(false)}
            aria-hidden="true"
          />

          <div className="ui-modal-shell max-w-md">
            <div className="ui-modal-header">
              <h3 className="text-lg font-semibold text-white">Choose avatar</h3>
              <button
                type="button"
                className="ui-btn-secondary px-3 py-1 text-xs"
                onClick={() => setAvatarPickerOpen(false)}
              >
                Close
              </button>
            </div>

            <div className="ui-modal-body">
              <div className="grid grid-cols-5 gap-2">
                {DEFAULT_AVATARS.map((avatar) => {
                  const selected = avatar.id === selectedAvatarId;
                  const avatarSrc = avatar?.src || null;
                  const canRenderAvatarImage =
                    !!avatarSrc && !failedAvatarSrcs.has(avatarSrc);
                  return (
                    <button
                      key={avatar.id}
                      type="button"
                      className={[
                        "h-12 overflow-hidden rounded-xl border text-xl transition",
                        selected
                          ? "border-blue-500 bg-blue-500/20"
                          : "border-neutral-700 bg-neutral-900 hover:bg-neutral-800",
                      ].join(" ")}
                      onClick={() => {
                        onSaveAvatarId?.(avatar.id);
                        setAvatarPickerOpen(false);
                      }}
                      title={avatar.label || avatar.id}
                    >
                      {canRenderAvatarImage ? (
                        <img
                          src={avatarSrc}
                          alt={avatar.label || avatar.id}
                          className="h-full w-full object-contain p-1"
                          onError={() => markAvatarSrcFailed(avatarSrc)}
                        />
                      ) : (
                        avatar?.icon || "🎲"
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}