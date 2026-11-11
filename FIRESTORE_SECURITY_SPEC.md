# Firestore Security Specification
## Board Game App — Data Model & Rules Checklist

**Date:** March 19, 2026  
**Target:** Broader beta release readiness  
**Document Purpose:** Plain-English security specification for all Firestore paths, with per-path read/create/update/delete rules, role enforcement, field constraints, and broader-beta readiness assessment.

---

## Part A: Inferred Firestore Data Model

### Collection Hierarchy

```
firestore/

├── /games/{gameId}
│   └── Global board game catalog, publicly readable
│       Fields: title, description, imageUrl, tags, createdBy, 
│                ratingTotal, ratingCount, createdAt, updatedAt
│
├── /ratings/{ratingId}
│   └── Global ratings store (one per user per game)
│       ID pattern: {userId}_{gameId}
│       Fields: userId, gameId, value (0.5-5.0), submittedAt
│
├── /users/{userId}
│   └── User profile (private)
│       Fields: nickname, avatarId, createdAt
│
├── /users/{userId}/collection/{gameId}
│   └── Personal collection entries
│       Fields: gameId, addedAt
│
├── /users/{userId}/groups/{groupId}
│   └── Index: which groups user belongs to
│       Fields: joinedAt, syncedCollectionAt (optional)
│
├── /userDirectory/{userId}
│   └── Public user directory for lookups
│       Fields: userId, nickname, nicknameLower, avatarId, 
│                isAnonymous, updatedAt
│
├── /groups/{groupId}
│   └── Group root document
│       Fields: name, ownerId, createdAt, updatedAt
│
├── /groups/{groupId}/members/{userId}
│   └── Group membership + permissions
│       Fields: userId, nickname, avatarId, role (owner|moderator|member),
│                joinedAt, nickname (synced from profile)
│
├── /groups/{groupId}/games/{gameId}
│   └── Materialized group collection (union of member collections)
│       Fields: title, description, imageUrl, tags, ratingTotal, ratingCount,
│                ownersCount, createdBy (original), updatedAt
│   │
│   └── /games/{gameId}/owners/{userId}
│       └── Who contributed this game to the group
│           Fields: addedAt
│
├── /groups/{groupId}/settings/meta
│   └── Group configuration/rules
│       Fields: disallowVotingOwnSubmission, moderatorsCanEditWeights,
│                hidden-tags, autoAdvanceWhenAllSubmitted, 
│                autoAdvanceWhenAllVoted, createdAt, createdBy
│
├── /groups/{groupId}/settings/weights
│   └── Weighted voting configuration
│       Fields: (game-specific weight values), createdAt, createdBy, updatedAt
│
├── /groups/{groupId}/activeSession/meta
│   └── Current session state
│       Fields: status (collecting|open|null), sessionIndex, ownerId,
│                activeVoteId, updatedAt
│
├── /groups/{groupId}/votes/{voteId}
│   └── Individual voting session
│       Fields: createdBy, status (collecting|open|closed), createdAt, 
│                openedAt, closedAt, candidates (gameId list),
│                winnerGameId, scoreBreakdown, weightsUsed, updatedAt
│   │
│   ├── /votes/{voteId}/submissions/{userId}
│   │   └── Member's game submission (collecting phase)
│   │       Fields: gameId (or isNoSubmission), submittedAt
│   │
│   └── /votes/{voteId}/ballots/{userId}
│       └── Member's vote on candidate games (voting phase)
│           Fields: gameId, submittedAt
│
├── /groups/{groupId}/pool/{gameId}
│   └── Vote pool + game activity stats
│       Fields: isActive, addedAt, cycleStartedAt, cycleVoteCount,
│                lifetimeVoteCount, lastVotedAt, lastWonAt, lastWonSession,
│                playedCount, lastPlayedAt, playedOverride, createdAt, updatedAt
│
└── /groups/{groupId}/plays/{playId}
    └── Past session record (history)
        Fields: voteId (reference to original vote), groupId, sessionIndex,
                 playedAt, winnerGameId, playedGameIds, resultMode
                 (ranked|coop-win|coop-loss|no-winner),
                 placements (userId + place), participantIds,
                 createdBy, createdAt, updatedAt
```

---

## Part B: Per-Path Security Rules Checklist

### Global Games Catalog: `/games/{gameId}`

**Purpose:** Public, global board game library. Any authenticated user can browse.

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Anyone (public) | None | All signed-in users can read any game. Anonymous users CANNOT read. |
| **CREATE** | Signed-in users | • User is authenticated<br>• `createdBy == request.auth.uid`<br>• Must include: title, description, createdAt, ratingTotal, ratingCount<br>• Optional: tags (if present, must be list)<br>• ratingTotal and ratingCount must be numbers | Anyone authenticated can add a game to the global catalog. Initial ratings are 0/0. |
| **UPDATE** | Creator or administrator for metadata; signed-in users for rating aggregates | **Either:**<br>1) Edit metadata: title, description, imageUrl, tags, updatedAt<br>   - `createdBy == request.auth.uid` or `admins/{uid}.isAdmin == true`<br>   - All fields type-validated<br>**OR**<br>2) Update ratings: ratingTotal, ratingCount<br>   - No source validation (client aggregates) | Metadata updates are creator/administrator-only. Rating aggregates remain separately writable by signed-in users. |
| **DELETE** | Creator or administrator | `resource.data.createdBy == request.auth.uid` or `admins/{uid}.isAdmin == true` | Other signed-in users cannot delete games. |

**Anonymous Access:** NO. Games are only visible to signed-in users.

**Broader-Beta Readiness:** ✅ **OK for game metadata/delete permissions** — creator or administrator checks are enforced.

**Additional Notes:**
- Rating aggregate arithmetic is not validated; the client updates aggregates from `/ratings` docs.

---

### Global Ratings: `/ratings/{ratingId}`

**Purpose:** User's individual game ratings. ID-based ownership: `{userId}_{gameId}`.

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Anyone (public) | None | Ratings visible to all. |
| **CREATE** | Signed-in users | • User is authenticated<br>• `ratingId` matches pattern `^{userId}_.*`<br>• `userId == request.auth.uid`<br>• `value` is number between 0.5 and 5.0<br>• Only userId field required | User can only create their own ratings. No cross-user writes. |
| **UPDATE** | Signed-in users | Same as CREATE | User can only update their own rating. Value bounds enforced. |
| **DELETE** | Signed-in users | Same as CREATE | User can only delete their own rating. |

**Anonymous Access:** NO. Anonymous users cannot rate games.

**Broader-Beta Readiness:** ✅ **OK** — ID-based ownership is secure.

---

### User Profile: `/users/{userId}`

**Purpose:** Private user account data (nickname, avatar, preferences).

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Self only | `isSelf(userId)` | User can only read their own profile. Profiles are not shared between users. |
| **CREATE** | Self only | `isSelf(userId)` | User creates their own profile on first sign-in. |
| **UPDATE** | Self only | `isSelf(userId)` | User updates their own profile (nickname, avatar). |
| **DELETE** | Self only | `isSelf(userId)` | Users can delete their own profile (rare, but allowed). |

**Anonymous Access:** NO. Anonymous users cannot maintain persistent profiles.

**Broader-Beta Readiness:** ✅ **OK** — Self-only isolation is correct.

---

### Personal Collection: `/users/{userId}/collection/{gameId}`

**Purpose:** User's private board game collection (owns/wants-to-own games).

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Self only | `isSelf(userId)` | User can only see their own collection. Collections are private. |
| **CREATE** | Self only | `isSelf(userId)` | User adds games to their collection. |
| **UPDATE** | Self only | `isSelf(userId)` | User updates collection entry (e.g., notes, status). |
| **DELETE** | Self only | `isSelf(userId)` | User removes games from collection. |

**Anonymous Access:** NO. Anonymous users cannot maintain persistent collections.

**Broader-Beta Readiness:** ✅ **OK** — Self-only isolation correct.

**Additional Notes:**
- Used as the source of truth for syncing shared games into groups.
- Client maintains a Set<gameId> for fast lookup; backed by this collection's existence.

---

### User-to-Group Index: `/users/{userId}/groups/{groupId}`

**Purpose:** Index: which groups a user belongs to. Used for efficient group discovery.

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Self only | `isSelf(userId)` | User can list their own group memberships. |
| **CREATE** | Self only | `isSelf(userId)` | Created when user joins a group. |
| **UPDATE** | Self only | `isSelf(userId)` | User updates metadata (e.g., syncedCollectionAt). |
| **DELETE** | Self only | `isSelf(userId)` | Deleted when user leaves a group. |

**Anonymous Access:** NO.

**Broader-Beta Readiness:** ✅ **OK**.

**Additional Notes:**
- This index allows efficient subscription: `onSnapshot(collection(db, "users", userId, "groups"))`
- Bidirectional: also reflected in `/groups/{groupId}/members/{userId}`.

---

### Public User Directory: `/userDirectory/{userId}`

**Purpose:** Public lookup registry for user profiles (nickname, avatar). Used for account searches during session-participant selection.

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Signed-in users | `signedIn()` | Any authenticated user can look up any profile. Anonymous users included (if signed in). |
| **CREATE** | Self only | `isSelf(userId)` && `userId == request.auth.uid`<br>• Must include: userId, nickname, nicknameLower, avatarId, updatedAt<br>• All fields type-validated | User creates their own directory entry (synced from profile). |
| **UPDATE** | Self only | Same as CREATE | User updates their directory entry. |
| **DELETE** | Never | `allow delete: if false;` | Directory entries cannot be deleted (retention). |

**Anonymous Access:** YES (if signed in). Anonymous accounts appear in directory with `isAnonymous == true`.

**Broader-Beta Readiness:** ✅ **OK** — Signed-in gating is correct.

**Additional Notes:**
- `nicknameLower` is stored for case-insensitive searches.
- `isAnonymous` flag helps client distinguish between real and guest accounts.
- No deletion allowed; directory is append-only.

---

### Group Root: `/groups/{groupId}`

**Purpose:** Group document (name, owner).

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Signed-in users | `signedIn()` | Any authenticated user can read group metadata (for discovery/browsing). |
| **CREATE** | Signed-in users | • User authenticated<br>• `ownerId == request.auth.uid`<br>• Must include: name, ownerId, createdAt | User becomes group owner when creating. |
| **UPDATE** | Owner only | `resource.data.ownerId == request.auth.uid` | Only owner can update group (rename, etc.). |
| **DELETE** | Owner only | `resource.data.ownerId == request.auth.uid` | Only owner can delete group (cascades to all sub-collections). |

**Anonymous Access:** NO. Only signed-in users can create/manage groups.

**Broader-Beta Readiness:** ✅ **OK** — Ownership gating is correct.

**Additional Notes:**
- No field-level constraints currently; client validates changes.

---

### Group Membership: `/groups/{groupId}/members/{userId}`

**Purpose:** Track group members, roles, and synced profile data.

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | • Group members OR<br>• Self (if group exists) | `isGroupMember(groupId)` OR<br>(`isSelf(userId)` && group exists) | Group members can see all members (transparency).<br>Users can read their own membership doc if they're trying to verify membership. |
| **CREATE** | User joining | • User authenticated<br>• `request.auth.uid == userId`<br>• Group exists | Users join groups by creating their membership doc. |
| **UPDATE** | • User OR<br>• Group owner | • User authenticated<br>• (`request.auth.uid == userId` OR `isGroupOwner(groupId)`) | User updates their own role/nickname; owner can change any member's role. |
| **DELETE** | • User OR<br>• Group owner | • User authenticated<br>• (`request.auth.uid == userId` OR `isGroupOwner(groupId)`) | User leaves group; owner can remove members. |

**Anonymous Access:** NO. Anonymous users cannot join groups.

**Broader-Beta Readiness:** ✅ **OK** — Membership gating is correct.

**Additional Notes:**
- Role values: "owner", "moderator", "member". Enforced by client; not validated in rules.
- Nickname is synced from profile; used for display in group context.
- avatarId stored here; allows per-group avatar visibility.

---

### Materialized Group Collection: `/groups/{groupId}/games/{gameId}` & `/games/{gameId}/owners/{userId}`

**Purpose:** Union of all members' collections for fast group-scoped game visibility.

**Structure:**
- `/groups/{groupId}/games/{gameId}` — Aggregate game doc with ownersCount
- `/groups/{groupId}/games/{gameId}/owners/{userId}` — Who shared this game

**Rules for `/groups/{groupId}/games/{gameId}`:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Group members | `isGroupMember(groupId)` | Members read the group's shared games. |
| **CREATE** | Group members | `isGroupMember(groupId)` | Members add games to group (synced from personal collection). |
| **UPDATE** | Group members | `isGroupMember(groupId)` | Members update game info (collaborative). |
| **DELETE** | Group members | `isGroupMember(groupId)` | Members remove games. ⚠️ **Should be restricted** (see below). |

**Rules for `/groups/{groupId}/games/{gameId}/owners/{userId}`:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Group members | `isGroupMember(groupId)` | Anyone in group can see who contributed a game. |
| **CREATE** | Member for self | `isGroupMember(groupId) && isSelf(userId)` | Members create their own owner entry when sharing. |
| **UPDATE** | Member for self | `isGroupMember(groupId) && isSelf(userId)` | Members update their entry (e.g., shared timestamp). |
| **DELETE** | Member for self | `isGroupMember(groupId) && isSelf(userId)` | Members remove their contribution. Only can delete own entry. |

**Anonymous Access:** NO. Anonymous users cannot join groups.

**Broader-Beta Readiness:** ✅ **OK** — Ownership-by-key is correct.

**Additional Notes:**
- `ownersCount` on game doc is updated via transaction when owners add/remove.
- Prevents double-counting: check if user already owns before incrementing.
- Group visibility is `ownersCount > 0` (hides games with no active contributors).

---

### Group Settings: `/groups/{groupId}/settings/{docId}`

**Purpose:** Store group configuration (rules, auto-advance, hidden tags, weights).

**Subdivisions:**
- `/groups/{groupId}/settings/meta` — General settings (moderator perms, voting rules)
- `/groups/{groupId}/settings/weights` — Weighted voting config

**Rules for `meta` doc:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Group members | `isGroupMember(groupId)` | All members can read settings. |
| **CREATE** | Owner only | `isGroupOwner(groupId) && docId == "meta"` | Owner creates meta settings (bootstrapped on demand). |
| **UPDATE** | Owner only | `isGroupOwner(groupId) && docId == "meta"` | Owner updates: disallowVotingOwnSubmission, moderatorsCanEditWeights, hidden-tags, autoAdvance flags. |
| **DELETE** | Owner only | `isGroupOwner(groupId) && docId == "meta"` | Owner can delete (reset to defaults). |

**Rules for `weights` doc:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Group members | `isGroupMember(groupId)` | All members can read weights. |
| **CREATE** | Per rule | `canEditWeights(groupId)` | Owner or moderator (if enabled in meta) can create. |
| **UPDATE** | Per rule | `canEditWeights(groupId)` | Owner or moderator can update. |
| **DELETE** | Per rule | `canEditWeights(groupId)` | Owner or moderator can delete (resets to defaults). |

**Anonymous Access:** NO.

**Broader-Beta Readiness:** ✅ **OK** — Ownership and role gating correct.

---

### Active Session Meta: `/groups/{groupId}/activeSession/meta`

**Purpose:** Track current voting session state (status, owner, activeVoteId).

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Group members | `isGroupMember(groupId)` | All members see session state. |
| **CREATE** | Group members | `isGroupMember(groupId) && request.resource.data.ownerId == request.auth.uid` | Member initiates a session (becomes owner). |
| **UPDATE** | See below | Complex state machine (3 paths) | **(1)** Owner/creator updates freely<br>**(2)** Members can transition collecting→open<br>**(3)** Members can clear on close (open→null, increment sessionIndex) |
| **DELETE** | Never | `allow delete: if false;` | Sessions cannot be deleted (history). |

**Anonymous Access:** NO.

**Broader-Beta Readiness:** ✅ **OK** — State machine prevents invalid transitions.

**Additional Notes:**
- Statuses: `"collecting"` → `"open"` → `"closed"` (or null after close)
- Session ownership gates who can make changes.
- State transitions are validated (no jumping from collecting to closed).

---

### Voting Sessions: `/groups/{groupId}/votes/{voteId}`

**Purpose:** Individual voting session + results.

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Group members | `isGroupMember(groupId)` | All members see votes. |
| **CREATE** | Group members | `isGroupMember(groupId) && createdBy == request.auth.uid && status in ["collecting", "open"]` | Member creates a vote session (becomes creator). |
| **UPDATE** | See below | **(1)** Transition collecting→open: any member (validates candidates)<br>**(2)** Transition open→closed: only creator or owner (validates winner/scores)<br>**(3)** Creator/owner can update freely | Specific state transitions allowed; restrictive. |
| **DELETE** | Never | `allow delete: if false;` | Votes cannot be deleted. |

**Anonymous Access:** NO.

**Broader-Beta Readiness:** ✅ **OK** — State machine enforced.

**Additional Notes:**
- Candidates list is finalized when moving to "open".
- score breakdown only set on close.
- weightsUsed stored for audit trail.

---

### Submissions (Collecting Phase): `/groups/{groupId}/votes/{voteId}/submissions/{userId}`

**Purpose:** Members' game submissions during collecting phase.

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Group members | `isGroupMember(groupId)` | All members see submissions. |
| **CREATE** | User for self | • `isGroupMember(groupId)`<br>• `isSelf(userId)`<br>• Vote must be in "collecting" status<br>• Either: game submission OR isNoSubmission flag<br>• Required fields validated | Member submits a game (or "no submission" placeholder). |
| **UPDATE** | User for self | Same as CREATE | Member changes their submission. |
| **DELETE** | User for self | Same as CREATE | Member retracts submission (allows changing mind). |

**Anonymous Access:** NO.

**Broader-Beta Readiness:** ✅ **OK** — Phase gating prevents tampering.

**Additional Notes:**
- Only allowed during `collecting` phase; rule checks vote.status.
- `disallowVotingOwnSubmission` rule prevents self-voting if enabled.

---

### Ballots (Voting Phase): `/groups/{groupId}/votes/{voteId}/ballots/{userId}`

**Purpose:** Members' votes on candidate games during voting phase.

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Group members | `isGroupMember(groupId)` | All members see ballots. |
| **CREATE** | User for self | • `isGroupMember(groupId)`<br>• `isSelf(userId)`<br>• Vote must be in "open" status<br>• `gameId` must be in vote.candidates<br>• Check `disallowOwnSubmission` rule if enabled<br>• Fields validated | Member votes for a game. |
| **UPDATE** | User for self | Same as CREATE | Member changes their vote. |
| **DELETE** | User for self | Same as CREATE | Member retracts vote. |

**Anonymous Access:** NO.

**Broader-Beta Readiness:** ✅ **OK** — Phase gating + candidate validation correct.

**Additional Notes:**
- `disallowVotingOwnSubmission` lookup is specific: checks if voter submitted this game.
- Allowed only during "open" phase.

---

### Vote Pool: `/groups/{groupId}/pool/{gameId}`

**Purpose:** Persistent vote queue + per-game activity stats.

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Group members | `isGroupMember(groupId)` | All members see pool state. |
| **CREATE** | Complex | **(1)** Member activation (during collecting)<br>**(2)** Owner playedOverride only | Members can activate games to the pool. Owner can set playedOverride. |
| **UPDATE** | Complex | **(1)** Member activation updates (during collecting)<br>**(2)** Session owner/owner can update stats<br>**(3)** Members can update own stats<br>**(4)** Owner playedOverride only | Members update pool state during session. Careful: stats include lastVotedAt, cycleVoteCount, lifetimeVoteCount, etc. |
| **DELETE** | Never | `allow delete: if false;` | Pool entries are never deleted. |

**Anonymous Access:** NO.

**Broader-Beta Readiness:** ✅ **OK** — Phase gating + role enforcement correct.

**Additional Notes:**
- Pool acts as stats accumulator during voting sessions.
- `playedOverride` is owner-only field (marks games as already-played to exclude from voting).
- Complex rule structure reflects intricate session lifecycle.

---

### Past Session Records (History): `/groups/{groupId}/plays/{playId}`

**Purpose:** Archive of completed sessions (who won, results, placements).

**Rules:**

| Operation | Who | Conditions | Details |
|-----------|-----|-----------|---------|
| **READ** | Group members | `isGroupMember(groupId)` | All members see history. |
| **CREATE** | Group members | • `isGroupMember(groupId)`<br>• `createdBy == request.auth.uid`<br>• Shape validates: groupId, voteId (immutable), createdAt, updatedAt, etc. | Any member can record a session played. |
| **UPDATE** | ⚠️ **ALL MEMBERS** | • `isGroupMember(groupId)`<br>• Shape validates<br>• groupId, voteId, createdBy, createdAt are immutable | ❌ **BUG:** Currently allows ANY group member to edit past sessions.<br>✅ **MUST FIX:** Should require owner/moderator. |
| **DELETE** | Never | `allow delete: if false;` | Plays cannot be deleted (audit trail). |

**Anonymous Access:** NO.

**Broader-Beta Readiness:** ❌ **BLOCKING** — Update rule missing owner/moderator check. FIX REQUIRED.

**Additional Notes:**
- `voteId` reference is immutable (backlink to original vote).
- `sessionIndex` ties to group session counter.
- `participantIds` list allows guest tracking (future feature).
- Placements are result-specific (ranked places or co-op binary).
- **Critical fix needed:** Add `&& (isGroupOwner(groupId) || memberRole(groupId) == "moderator")` to update rule.

---

## Part C: Must-Have Rule Protections Before Broader Beta

### 🔴 CRITICAL FIXES REQUIRED

**1. Game Deletion Permission Check — implemented**
```
Location: /games/{gameId} — delete rule
Current:  creator or administrator (`admins/{uid}.isAdmin == true`)
Status:   Implemented and covered by Firestore rules tests
```

**2. Game Metadata Editing Permission — implemented**
```
Location: /games/{gameId} — update rule (metadata path)
Current:  creator or administrator (`admins/{uid}.isAdmin == true`)
Status:   Implemented and covered by creator, administrator, and unauthorized-user tests
Note:     Rating aggregate updates remain separately available to signed-in users
```

**3. Past-Session Editing Permissions**
```
Location: /groups/{groupId}/plays/{playId} — update rule
Current:  allow update: if isGroupMember(groupId) && ... (ALL members allowed)
Required: && (isGroupOwner(groupId) || memberRole(groupId) == "moderator")
Impact:   Prevents members from tampering with historical records
Severity: HIGH — allows re-writing session results, placements, winners
```

### 🟠 STRONGLY RECOMMENDED BEFORE BROADER BETA

**4. Group Game Deletion Restrictions**
```
Location: /groups/{groupId}/games/{gameId} — delete rule
Current:  allow delete: if isGroupMember(groupId);
Consider: More restrictive — only allow removal through owner/moderator
Rationale: Members can currently remove any game from group collection
            (might be intentional, but risky if enforced to all members)
Status:   Check product intent; may be acceptable
```

**5. Role Value Validation**
```
Location: /groups/{groupId}/members/{userId} — update rule
Current:  Role values not validated in rules (only client-side)
Recommended: Validate role in ["owner", "moderator", "member"] on update
Rationale:   Prevents malformed roles from client bugs
```

---

## Part D: Acceptable Temporary Beta Exceptions

These are intentional permissive behaviors acceptable for **controlled testing only**:

### Beta Exception #1: Anonymous Accounts Can Rate Games
```
Path: /ratings/{ratingId}
Behavior: Anonymous users (signedIn but isAnonymous==true) can create ratings
Impact: Ratings will include anonymous contributions
Rationale: Acceptable for controlled beta; should be restricted pre-monetization
Action:   Log anonymous rating sources; plan to restrict later
```

### Retired Beta Exception #2: Open Game Metadata Edits
```
Path: /games/{gameId} — update rule
Previous behavior: Any signed-in user could edit title, description, imageUrl, and tags
Current behavior: Creator or administrator only; rating aggregates remain separately writable
Status:   Retired; enforcement is in Firestore rules and UI, with regression tests
```

### Beta Exception #3: Group Members Can Remove Games Freely
```
Path: /groups/{groupId}/games/{gameId} — delete rule
Behavior: Any group member can delete a shared game from group collection
Impact: Accidental/malicious game removal from voting pool
Rationale: Simplifies UI; members are in controlled groups
Risk: Cross-member friction over removed games
Action:   Clarify product behavior; consider restricting to owner/moderator
Timeline: Acceptable for controlled beta if groups are small/trusted
```

### Beta Exception #4: Member Role Values Not Validated
```
Path: /groups/{groupId}/members/{userId} — update rule
Behavior: Role field accepts any string value; only client validates
Impact: Malformed roles could break permissions checks
Rationale: Client is single source of truth during beta
Risk: Low (only affects client bugs, not external attacks)
Action:   Add role enum validation before broader beta
Timeline: Recommended fix soon
```

---

## Part E: Data Model Changes That Would Improve Security

### ✅ Resolved Issue #1: Game Metadata Permission
```
Current: Metadata updates require the creator or an administrator
         (`admins/{uid}.isAdmin == true`); rating aggregate updates remain separate.
Verification: Covered by `tests/rules/firestore.rules.test.mjs`.
```

### 🔍 Issue #2: Role Strings Not Enumerated
```
Problem:  /groups/{groupId}/members/{userId}.role is a string with no
          validation. Values should be: "owner", "moderator", "member"
          
Solution: Add enum validation in rules
  && memberRole in ["owner", "moderator", "member"]
  
Or:       Add a computed helper:
  function isValidRole(role) {
    return role in ["owner", "moderator", "member"];
  }
```

### 🔍 Issue #3: Plays Path Mixes Update Patterns
```
Problem:  /groups/{groupId}/plays/{playId} allows ANY member to update
          (current rules show no owner/moderator check). This is the
          past-session editing bug mentioned earlier.
          
Solution: Add explicit ownership/role checks:
  allow update: if isGroupMember(groupId)
    && (isGroupOwner(groupId) || memberRole(groupId) == "moderator")
    && ... validation ...;
```

### 🔍 Issue #4: Group Game Owner Counting Fragile
```
Problem:  /groups/{groupId}/games/{gameId}/owners/{userId} uses increment()
          to track ownersCount, but:
          - No validation that owner entry actually exists on delete
          - Double-add protection relies on client idempotency
          - Cleanup when owner leaves group is manual
          
Solution: Use transactions explicitly in client code:
  tx.get(ownerRef)
  -> if (shouldShare && !exists) increment
  -> if (!shouldShare && exists) decrement
  
Or:       Add Cloud Functions to recount ownersCount on member leave
```

### 🔍 Issue #5: Anonymous Account Proliferation
```
Problem:  Anonymous accounts accumulate in /userDirectory/{userId}
          No retention policy or cleanup mechanism
          
Solution: 
  1) Add metadata to userDirectory: lastActiveAt, createdAt
  2) Implement Cloud Function to delete stale anonymous accounts after 30 days
  3) Or: Add auth rule to restrict anonymous accounts post-beta
```

### 🔍 Issue #6: No Audit Trail for Session Modifications
```
Problem:  Past sessions can be edited; no history of who changed what/when
          
Solution:
  1) Add updatedBy field to /groups/{groupId}/plays/{playId}
  2) Log major changes (winner, results) separately?
  3) Or: Make plays fully immutable; create new plays for corrections
  
Recommendation: For broader beta, add updatedBy to plays; later add full audit log
```

### 🔍 Issue #7: Group Member Data Transparency May Be Too Broad
```
Problem:  All group members can read all member data (nickname, avatar, role)
          This is intentional for collaboration, but:
          - Anonymous members are visible by real name
          - Member roles/permissions visible to all
          
Solution: This is BY DESIGN for groups. Acceptable. Document in privacy policy.
```

---

## Part F: Per-Path Security Rules Specification (Summary Table)

| Path | Read | Create | Update | Delete | Anonymous | Beta-Ready? |
|------|------|--------|--------|--------|-----------|-------------|
| `/games/{gameId}` | Public | Signed-in (creator) | Creator/admin for metadata; signed-in for rating aggregates | Creator/admin | NO | ✅ OK |
| `/ratings/{ratingId}` | Public | Self-only | Self-only | Self-only | NO | ✅ OK |
| `/users/{userId}` | Self-only | Self-only | Self-only | Self-only | NO | ✅ OK |
| `/users/{userId}/collection/{g}` | Self-only | Self-only | Self-only | Self-only | NO | ✅ OK |
| `/users/{userId}/groups/{groupId}` | Self-only | Self-only | Self-only | Self-only | NO | ✅ OK |
| `/userDirectory/{userId}` | Signed-in | Self-only | Self-only | NO DELETE | YES | ✅ OK |
| `/groups/{groupId}` | Signed-in | Signed-in (creator) | Owner-only | Owner-only | NO | ✅ OK |
| `/groups/{groupId}/members/{u}` | Members/Self | Signed-in (join) | Self/Owner | Self/Owner | NO | ✅ OK |
| `/groups/{groupId}/games/{g}` | Members | Members | Members | ⚠️ OPEN | NO | ⚠️ REVIEW |
| `/groups/{groupId}/games/{g}/owners/{u}` | Members | Self-only | Self-only | Self-only | NO | ✅ OK |
| `/groups/{groupId}/settings/meta` | Members | Owner-only | Owner-only | Owner-only | NO | ✅ OK |
| `/groups/{groupId}/settings/weights` | Members | canEditWeights | canEditWeights | canEditWeights | NO | ✅ OK |
| `/groups/{groupId}/activeSession/meta` | Members | Members | Complex SM | NO DELETE | NO | ✅ OK |
| `/groups/{groupId}/votes/{voteId}` | Members | Members (creator) | Restricted SM | NO DELETE | NO | ✅ OK |
| `/groups/{groupId}/votes/{voteId}/submissions/{u}` | Members | Self-only (collecting) | Self-only (collecting) | Self-only (collecting) | NO | ✅ OK |
| `/groups/{groupId}/votes/{voteId}/ballots/{u}` | Members | Self-only (open) | Self-only (open) | Self-only (open) | NO | ✅ OK |
| `/groups/{groupId}/pool/{gameId}` | Members | Members (activation) | Complex | NO DELETE | NO | ✅ OK |
| `/groups/{groupId}/plays/{playId}` | Members | Members (creator) | ❌ **ALL MEMBERS** | NO DELETE | NO | ❌ BROKEN |

---

## Part G: Conclusion & Recommendations

### Status Assessment

**Previously identified risky paths:** 2/18 (historical checklist; game metadata/delete permissions are now enforced)

- **`/groups/{groupId}/plays/{playId}`** — update rule allows any member

### Recommendation for Broader Beta

**MUST FIX before launch:**
1. Past-session edit: Add owner/moderator check

**SHOULD FIX soon after (not blocking, but high-priority):**
2. Group game deletion: Review product intent; consider restricting
3. Role validation: Add enum check in rules
4. Anonymous account cleanup: Implement retention policy

**CAN DEFER (post-beta):**
5. Audit trail for session edits
6. Cloud Function for ownersCount synchronization
7. Anonymous account identity restrictions

### Final Verdict

**Broader Beta Readiness:** Reassess remaining findings against the current rules.
**Game catalog:** Creator/administrator metadata and delete checks are implemented; rating aggregate updates remain separately writable by signed-in users.
