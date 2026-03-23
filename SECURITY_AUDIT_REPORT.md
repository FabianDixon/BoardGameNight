# Security and Release-Readiness Audit Report
## Board Game App (React + Firebase)
**Date:** March 19, 2026  
**Audit Scope:** Client code, Firestore rules, permission enforcement, data flows  
**Target:** Broader beta release readiness

---

## Executive Summary

The Board Game App has achieved good architectural stability with recent hardening work on core sensitive flows. However, **two critical security gaps** and several medium-severity issues were identified that should be addressed before broader beta:

1. **[CRITICAL]** Game editing/deletion permissions are not properly enforced—ANY authenticated user can edit or delete ANY game
2. **[CRITICAL]** Game deletion lacks permission checks in Firestore rules, allowing rule bypass
3. **[HIGH]** Past-session editing permissions are only enforced in client code; rules enforcement is missing
4. **[HIGH]** Submissions/ballots allow deletion during collecting phase; intentional but risky
5. **[MEDIUM]** Group membership reads expose all member data to any group member
6. **[MEDIUM]** Anonymous accounts can perform operational actions (collection/rating/voting)
7. **[MEDIUM]** Email export feature may leak session data to email clients
8. **[LOW]** Playback/history editing has minimal validation on placements data

**Bottom Line:** The app is **NOT ready for broader beta** without fixes to critical issues #1 and #2. High-priority items should also be addressed. The codebase itself is well-structured and most permission flows are correctly hardened; these gaps are specific and fixable.

---

## Findings by Severity

### 🔴 CRITICAL: Game Editing Permissions Not Enforced

**Issue:** Any authenticated user can edit any game (no ownership check).

**Files Involved:**
- [src/App.jsx](src/App.jsx#L3345) - Game edit permission hardcoded to `canEdit={!!user}`
- [firestore.rules](firestore.rules#L62-L91) - Allows ANY signed-in user to update games

**Current Behavior:**
```javascript
// App.jsx line 3345
// canEdit={user?.uid && selectedGameFresh.createdBy === user.uid}  // COMMENTED OUT ❌
canEdit={!!user}  // ANY authenticated user can edit
```

**Abuse Scenario:**
1. User A creates a game "Catan" with accurate description
2. User B (malicious) can edit that game to vandalize title, description, image, or tags
3. No audit trail; game metadata is corrupted for all users
4. Affects voting outcomes if games are edited mid-session

**Impact:** Data integrity, product trust, user experience  
**Severity:** CRITICAL — blocks broader beta

**Fix Locations:**
- **Client:** Uncomment the permission check in App.jsx line 3345
- **Firestore Rules:** Add ownership validation to the game update rule

**Recommended Fix:**

**In [src/App.jsx](src/App.jsx#L3340-L3350):**
```javascript
canEdit={user?.uid && selectedGameFresh.createdBy === user.uid}
```

**In [firestore.rules](firestore.rules#L62-L91):**
```javascript
allow update: if signedIn() && (
  (
    resource.data.createdBy == request.auth.uid  // ADD THIS CHECK
    && request.resource.data.diff(resource.data).changedKeys()
      .hasOnly(['title', 'description', 'imageUrl', 'tags', 'updatedAt'])
    // ... rest of validation
  )
  || (
    request.resource.data.diff(resource.data).changedKeys()
      .hasOnly(['ratingTotal', 'ratingCount'])
    && request.resource.data.ratingTotal is number
    && request.resource.data.ratingCount is number
  )
);
```

---

### 🔴 CRITICAL: Game Deletion Allows Permission Bypass

**Issue:** Firestore rules allow ANY signed-in user to delete ANY game (no ownership check).

**Files Involved:**
- [firestore.rules](firestore.rules#L93) - `allow delete: if signedIn();`

**Current Rule:**
```javascript
match /games/{gameId} {
  // ... create, read, update rules
  allow delete: if signedIn();  // ❌ NO OWNERSHIP CHECK
}
```

**Abuse Scenario:**
1. User A creates game "Ticket to Ride" (legitimate catalog entry)
2. User B calls `deleteDoc(db, "games", gameId)` directly
3. Game is deleted from firestore, removed from all group collections
4. Game voting data becomes orphaned

**Impact:** Data loss, voting integrity, product reliability  
**Severity:** CRITICAL — blocks broader beta

**Recommended Fix:**

In [firestore.rules](firestore.rules#L93):
```javascript
allow delete: if signedIn() && resource.data.createdBy == request.auth.uid;
```

---

### 🟠 HIGH: Past-Session Editing Permissions Only in Client Code

**Issue:** Client enforces owner/moderator-only editing of past sessions, but **no corresponding Firestore rule** exists to block non-owners.

**Files Involved:**
- [src/App.jsx](src/App.jsx#L703-L709) - Client-side permission check
- [firestore.rules](firestore.rules#L384-L416) - Plays rules allow ANY group member to edit

**Current Client Check:**
```javascript
const canEditPastSession = useMemo(() => {
  if (!user || !currentGroupId) return false;
  if (currentGroup?.ownerId === user.uid) return true;
  return myRole === "moderator";
}, [user, currentGroupId, currentGroup, myRole]);
```

**Current Firestore Rule for Plays:**
```javascript
match /groups/{groupId}/plays/{playId} {
  allow read: if isGroupMember(groupId);
  allow create: if isGroupMember(groupId)  // ✓ OK
    && request.auth.uid == request.resource.data.createdBy
    && isValidPlayRecordShape();
  
  allow update: if isGroupMember(groupId)  // ❌ MISSING OWNER/MODERATOR CHECK
    && isValidPlayRecordShape()
    && ...;
```

**Abuse Scenario:**
1. Session is closed; play record saved (history archived)
2. Regular group member bypasses client and calls: `updateDoc(doc(..., "plays", playId), { winnerGameId: "game2" })`
3. Past session result is changed without owner/mod approval
4. Statistics become unreliable

**Impact:** Historical data integrity, team trust, analytics reliability  
**Severity:** HIGH — blocks broader beta

**Recommended Fix:**

In [firestore.rules](firestore.rules#L398-L416), add owner/moderator checks:
```javascript
allow update: if isGroupMember(groupId)
  && isValidPlayRecordShape()
  && request.resource.data.groupId == resource.data.groupId
  && request.resource.data.voteId == resource.data.voteId
  && (resource.data.createdBy == null || request.resource.data.createdBy == resource.data.createdBy)
  && (resource.data.createdAt == null || request.resource.data.createdAt == resource.data.createdAt)
  // ADD THESE LINES:
  && (isGroupOwner(groupId) || memberRole(groupId) == "moderator");
```

---

### 🟠 HIGH: Submissions/Ballots Can Be Deleted (Intentional but Risky)

**Issue:** Submissions and ballots allow full delete during `collecting` phase; while this is intentional for UI UX (unsumbit/revote), it lacks explicit safeguards.

**Files Involved:**
- [firestore.rules](firestore.rules#L451-L467) - Ballots
- [firestore.rules](firestore.rules#L435-L449) - Submissions

**Current Rules:**
```javascript
match /groups/{groupId}/votes/{voteId}/submissions/{userId} {
  allow create, update, delete: if isGroupMember(groupId)
    && isSelf(userId)
    && voteStatus() == "collecting"  // ✓ GATED: only during collecting
    && (isGameSubmission() || isNoSubmissionRecord());
}

match /groups/{groupId}/votes/{voteId}/ballots/{userId} {
  allow create, update, delete: if isGroupMember(groupId)
    && isSelf(userId)
    && voteDoc().status == "open"  // ✓ GATED: only during open
    && ...;
}
```

**Status:** ✓ **Actually OK**  
- Deletions are gated to specific session phases (collecting/open)
- Destructive operations only allowed when reverting is intended
- Per-user scope prevents cross-user tampering

**Recommendation:** This is an intentional beta tradeoff; no fix needed. Document the behavior for moderators.

---

### 🟠 HIGH: Group Membership Reads Expose All Member Data

**Issue:** ANY group member can read ANY other member's profile within the group (nickname, avatarId, role).

**Files Involved:**
- [firestore.rules](firestore.rules#L156-L176) - Group membership rules
- Firestore rule line 157: `allow read: if isGroupMember(groupId)`

**Current Rule:**
```javascript
match /groups/{groupId}/members/{userId} {
  allow read: if isGroupMember(groupId)  // ✓ Can see all members
    || (isSelf(userId) && exists(/databases/$(database)/documents/groups/$(groupId)));
  
  // ... 
}
```

**Status:** ✓ **By Design**  
- Groups are collaborative spaces; member transparency is intentional
- Nickname, avatarId, and role are needed for UX (voting, results, seat randomizer)
- No personal data beyond what's in group context is exposed

**Recommendation:** No fix needed. This is a conscious design choice.

---

### 🟠 HIGH: Anonymous Accounts Can Participate in Full Workflows

**Issue:** Anonymous (guest) accounts can:
- Create games
- Rate games
- Add/remove from personal collection
- Join groups
- Submit votes and ballots
- View group data and histories

**Files Involved:**
- [src/App.jsx](src/App.jsx#L379) - Anonymous sign-in option
- [firestore.rules](firestore.rules#L6) - `signedIn()` is the only auth gate; no role differentiation

**Current Login Flow:**
```javascript
// App.jsx
if (choice === "guest") {
  signInAnonymously(auth);  // ✓ Allowed & intended
  return;
}
```

**Status:** ✓ **Intentional for Controlled Beta**  
- Per PROJECT_CONTEXT.md, anonymous access is acceptable during controlled testing
- Firestore rules don't explicitly distinguish; all signed-in users are treated the same
- Real concern arises only when expanding beyond controlled groups

**Associated Findings:**
- Email export feature fails gracefully for anonymous users: `canEmailExport = user.email`
- File export via clipboard works fine for anonymous users
- No explicit "anonymous account" restrictions in data model (yet)

**Recommendation:** This is acceptable for broader controlled beta IF:
1. Clarify product expectation: are anonymous accounts meant to be permanent or session-only?
2. Add explicit data retention policy (e.g., delete orphaned anonymous account data after 30 days)
3. Plan for future: once monetization is live, require real accounts for full participation
4. Consider adding rate-limiting or spam detection as anonymous-user risk mitigation

---

### 🟡 MEDIUM: Email Export Leaks Session Data to Email Clients

**Issue:** Email export feature creates a `mailto:` link with full session JSON copied to clipboard, then user pastes into email. Email clients (Gmail, Outlook) may store message drafts/history with sensitive session data (game titles, placements, participant IDs, session results).

**Files Involved:**
- [src/utils/emailExport.js](src/utils/emailExport.js)
- Usage in [src/App.jsx](src/App.jsx) (not shown in excerpts but referenced)

**Current Code:**
```javascript
export function buildSessionMailto({ groupName, voteId }) {
  const subject = encodeURIComponent(`BoardGameNight – Session export ...`);
  const body = encodeURIComponent([
    `Session export: ${voteId}`,
    groupName ? `Group: ${groupName}` : "",
    "",
    "The session JSON has been copied to your clipboard.",
    "Paste it into this email and send it.",
  ].filter(Boolean).join("\n"));
  
  return `mailto:?subject=${subject}&body=${body}`;
}

export async function copyJsonToClipboard(payload) {
  const json = JSON.stringify(payload, null, 2);
  await navigator.clipboard.writeText(json);  // Full session data
  return json.length;
}
```

**Risk:**
1. User copies full session JSON (includes all game names, player placements, results)
2. User composes email (subject + body auto-filled, JSON pasted as attachment or inline)
3. Email client stores draft, sent copy, cache
4. If account is compromised, all past exported sessions are accessible

**Severity:** MEDIUM — affects privacy/data retention but:
- User is actively choosing to export
- Only their own sessions (they have permission to view)
- Email provider security is outside scope
- No automatic/hidden leakage

**Abuse Scenario (lower probability but possible):**
- Admin exports session for debugging, email is intercepted
- Malicious actor gains access to group member placements, game collection, voting patterns

**Recommended Fix:**

**Option A (Recommended):** Add encryption/password-protection layer
```javascript
// Encrypt before copying; provide decryption UI
// Or: Generate secure, time-limited download link instead of clipboard

// Future: replace mailto with:
// 1. Generate shareable link (Firebase Realtime Database or Cloud Storage signed URL)
// 2. Link expires after 24 hours + 1 download
// 3. No persistent clipboard/email history
```

**Option B (Minimum):** Add user warning
```javascript
// Show toast: "Session data will be copied to clipboard. Email providers may retain copies."
// Offer option: "Download as file instead" (if client-side download implemented)
```

**Current Status:** Not a blocker for controlled beta, but document this risk.

---

### 🟡 MEDIUM: Voting Ballot Changes During Open Phase

**Issue:** Users can update/delete their ballot votes even after voting is open, allowing last-second vote swapping or regret changes. While intentional for UX, there's minimal audit trail.

**Files Involved:**
- [firestore.rules](firestore.rules#L451-L467) - Ballots allow create, update, delete during `open` phase

**Current Rule:**
```javascript
match /groups/{groupId}/votes/{voteId}/ballots/{userId} {
  allow create, update, delete: if isGroupMember(groupId)
    && isSelf(userId)
    && voteDoc().status == "open"
    && ...;
}
```

**Status:** ✓ **By Design**  
- Reflects interactive voting UX (users can change mind before voting closes)
- Gated to `open` phase; once closed, ballots are immutable

**Consideration:** No audit trail of vote changes. If game balance is disputed, no way to verify original vote intent.

**Recommendation:** For broader beta, document this behavior. If future feature work includes voting audit trails, add ballot history log.

---

### 🟡 MEDIUM: Rating Updates Not Validated Against Game Ownership

**Issue:** Ratings are stored globally and any authenticated user can increment/decrement `ratingTotal` and `ratingCount` on any game. While the Firestore rule limits writes to the defined fields, there's no validation that the rating document's creator ownership is enforced.

**Files Involved:**
- [firestore.rules](firestore.rules#L97-C112) - Ratings rule
- Rating updates are triggered by [src/App.jsx](src/App.jsx#L1480) `rateGame()`

**Current Rule:**
```javascript
match /ratings/{ratingId} {
  allow read: if true;  // Ratings are public
  
  allow create, update, delete: if signedIn()
    && ratingId.matches('^' + request.auth.uid + '_.*')  // ✓ ID-based ownership
    && request.resource.data.userId == request.auth.uid
    && request.resource.data.value is number
    && request.resource.data.value >= 0.5
    && request.resource.data.value <= 5;
}
```

**Status:** ✓ **Actually OK**  
- Ratings use ID-based ownership: `{userId}_{gameId}`
- Only the rating creator can modify their own rating
- Game's ratingTotal is updated by client; rule only allows valid numeric ranges

**Concern:** Game total/count integrity depends on correct client-side behavior. If client bugs cause incorrect totals, there's no server-side counter-validation.

**Recommendation:** Monitor for rating anomalies in broader beta. Consider server-side aggregation if ratings become critical for game ranking.

---

### 🟡 MEDIUM: Unvalidated User Directory Lookups in Session Edit

**Issue:** Past-session edit modal allows searching for participant accounts via [src/App.jsx](src/App.jsx#L1612) `searchSessionAccounts()`, which performs unconstrained reads on `userDirectory` collection.

**Current Code:**
```javascript
const searchSessionAccounts = useCallback(async (rawQuery) => {
  const requestedUserId = String(rawQuery || "").trim();
  if (!requestedUserId) return [];

  const exactSnap = await getDoc(doc(db, "userDirectory", requestedUserId));
  if (!exactSnap.exists()) return [];

  const data = exactSnap.data() || {};
  const userId = String(data.userId || exactSnap.id || "").trim();
  // ...
  return results;
}, []);
```

**Issue:** This performs exact-match lookups on user directory. While the return is limited and safe, a malicious client could:
1. Brute-force UIDs to enumerate user accounts
2. Discover hashed user IDs to build attack lists

**Status:** ⚠️ **Low practical risk** because:
- Firebase UID enumeration is hard (128-bit space)
- Only exposes nickname, avatarId, anonymous status (non-sensitive)
- Firestore rules already restrict read access: `allow read: if signedIn()`

**Recommendation:** Add rate-limiting if user enumeration attacks become apparent. For now, acceptable beta tradeoff.

---

### 🟢 LOW: Past-Session Placement Validation is Minimal

**Issue:** Past-session editing accepts placements with minimal data validation—relies on client-side normalization.

**Files Involved:**
- [src/components/PastSessionEditModal.jsx](src/components/PastSessionEditModal.jsx#L80-L100) - Client-side normalization
- [firestore.rules](firestore.rules#L384-L416) - Plays rule has `isValidPlayRecordShape()` but no placement-specific validation

**Current Validation:**
```javascript
function normalizePlacements(placements, resultMode) {
  const mode = normalizeResultMode(resultMode, "no-winner");
  if (mode === "coop-loss" || mode === "no-winner") return [];

  const deduped = new Map();
  for (const entry of Array.isArray(placements) ? placements : []) {
    const userId = String(entry?.userId || "").trim();
    if (!userId) continue;
    const placeValue = Number(entry?.place);
    if (!Number.isFinite(placeValue) || placeValue < 1) continue;
    deduped.set(userId, {
      userId,
      place: mode === "coop-win" ? 1 : Math.floor(placeValue),
    });
  }

  return [...deduped.values()].sort((a, b) => {
    if (a.place !== b.place) return a.place - b.place;
    return a.userId.localeCompare(b.userId);
  });
}
```

**Status:** ✓ **OK for Beta**  
- Normalization filters invalid data (non-integer, <1, missing userId)
- Deduplication prevents duplicate placements
- Sorting ensures consistency

**Recommendation:** No fix needed. Data is normalized safely. For analytics/reporting, add validation layer if placement data becomes source-of-truth for leaderboards.

---

### 🟢 LOW: Group Deletion Allows Cascade But No Warning

**Issue:** Group owners can delete groups, which cascades to all sub-collections (members, votes, sessions, etc.). No explicit warning; immediate action.

**Files Involved:**
- [firestore.rules](firestore.rules#L142-C154) - Group deletion rule `allow delete: if ... resource.data.ownerId == request.auth.uid`
- [src/App.jsx](src/App.jsx) group deletion handler (not shown, but exists)

**Status:** ✓ **OK for Beta**  
- Only owner can delete
- Cascade is intentional (clean slate)
- Deletion is permanent; consider adding confirmation modal

**Recommendation:** Add confirm dialog before deletion (already done in most UIs). No security fix needed.

---

## Release-Readiness Checklist

### ✅ Already Hardened
- ✅ Group membership gating on readers (correct)
- ✅ Submission/ballot locking to session phases (correct)
- ✅ Vote creation/closing limited to vote owner or group owner (correct)
- ✅ Weights editing restricted to owner or moderator (correct)
- ✅ Group settings restricted to owner (correct)
- ✅ Personal collection isolated per user (correct)
- ✅ Rating ownership per user (correct)

### 🔴 Must Fix Before Broader Beta
- [ ] **Fix game editing permission**: Uncomment createdBy check in App.jsx + update Firestore rule
- [ ] **Fix game deletion permission**: Add createdBy check to Firestore rule
- [ ] **Add plays/session editing to rules**: Enforce owner/moderator check in Firestore rules (not just client)

### 🟠 High Priority (Should Fix for Broader Beta)
- [ ] **Clarify anonymous account policy**: Document whether guest accounts are permanent or session-only; add data retention policy
- [ ] **Mitigate email export risk**: Add warning or implement secure export mechanism (signed URL, encryption)
- [ ] **Add audit logging concept**: Plan for future votes/placement audit trails if needed for disputes

### 🟡 Medium Priority (Nice to Have for Broader Beta)
- [ ] **Add user enumeration rate-limiting**: If directory lookups seem risky
- [ ] **Confirm group deletion UX**: Ensure delete confirmation modal is present
- [ ] **Profile privacy review**: Confirm transparent about nickname/avatar visibility in groups

### 🟢 Future / Not Necessary for Broader Beta
- [ ] Placement data leaderboard validation (analytics layer)
- [ ] Voting audit trail (future feature)
- [ ] User account role differentiation beyond anonymous/real (post-monetization)

---

## Known Temporary Beta Exceptions

These are intentional design choices acceptable for controlled/broader beta:

1. **Anonymous accounts allowed:** Users can sign in as guests. Acceptable because:
   - App is not monetized
   - Users are still in controlled groups (group membership governs access)
   - No explicit anonymous-specific data restrictions yet
   - Will be revisited post-launch

2. **Email export behavior:** Sessions are exported via clipboard + email. Acceptable because:
   - User is explicitly choosing to export (not automatic)
   - Email provider security is user's responsibility
   - Alternative: implement secured download/share link later

3. **Minimal voting audit trail:** Ballots can be changed during open phase; no history. Acceptable because:
   - Intentional UX (users can revote)
   - Only visible during `open` phase
   - Immutable after voting closes
   - For analytics, add audit layer later if needed

4. **Group member data transparency:** All members see all member profiles within group. Acceptable because:
   - Groups are collaborative; transparency is intentional
   - No sensitive personal data exposed (only nickname, avatar, role)
   - Can be revisited if privacy concerns arise

---

## Summary & Recommendations

### For Immediate Action (Before Broader Beta Launch):
1. **Fix game editing permission** (30 min)
   - Client: Uncomment permission check in App.jsx
   - Rules: Add `createdBy ==` check
   
2. **Fix game deletion permission** (15 min)
   - Rules: Add `createdBy ==` check
   
3. **Add plays/session editing to rules** (30 min)
   - Rules: Add owner/moderator enforcement to plays update rule

4. **Run end-to-end permission tests:**
   - Verify only game creator can edit games
   - Verify only game creator can delete games
   - Verify only owner/moderator can edit past sessions
   - Test with different user roles (owner, moderator, member)

### For Documentation:
1. Create a user-facing **Privacy Policy** addressing:
   - Anonymous account handling
   - Group member data visibility
   - Email export behavior

2. Create an **Admin Guide** for group owners covering:
   - Who can edit past sessions (owner/moderator only)
   - Game management responsibilities
   - Data retention expectations

3. Document **Known Limitations**:
   - Email exports may be retained by email providers
   - Anonymous accounts may be deleted after 30 days (future)
   - Groups are fully transparent to members

### For Monitoring (Post-Launch):
- Monitor game editing patterns for vandalism
- Watch for unusual rating submission patterns
- Track user enumeration attempts (if any)
- Gather feedback on anonymous account experience

---

## Files Requiring Changes

1. [src/App.jsx](src/App.jsx#L3345)
   - Uncomment game edit permission check
   
2. [firestore.rules](firestore.rules#L62-L93)
   - Add `createdBy` check to game update rule
   - Add `createdBy` check to game delete rule
   - Add owner/moderator check to plays update rule

No other files need changes for these critical fixes.

---

## Conclusion

The Board Game App is **architecturally sound** with good permission patterns in most areas. The identified issues are **specific and fixable**, not indicative of broader design problems. After fixing the three critical/high-priority issues, the app will be **ready for broader beta** with confidence that the core security boundaries are enforced.

The team has done excellent work on collection-to-group sync, voting flows, and session management. These fixes ensure that game library integrity and session history trust are maintained as the user base expands.

**Status: READY TO PROCEED after fixes**
