# Project audit and improvement log

This is the working record for the project-wide audit requested on November 10,
2026. It captures the scope, findings, decisions, validation, and follow-up
work. The goal is to improve reliability and maintainability without replacing
the product's established workflows.

## Context and guardrails

- Read [PROJECT_CONTEXT.md](../PROJECT_CONTEXT.md), the
  [UI design reference](../UI_DESIGN_REFERENCE.md), and the applicable
  security and testing documentation before changing sensitive flows.
- Prefer focused, testable fixes over broad rewrites. Preserve the existing
  user experience unless a change is justified and recorded below.
- Treat group membership, collection synchronization, Firestore listener
  ordering, voting, and session history as high-sensitivity flows.
- Do not modify production data or run migrations or cleanup scripts against
  production as part of this audit without a separate, explicit decision.
- Independent reviewers should report evidence and risks; fixes should be
  reviewed again and validated. A review without findings is not a guarantee
  that the project has no remaining bugs.
- Agents share the current working tree. Separate branches are optional, not
  required; avoid switching branches while other agents are working.

## Current scope

The user selected **bugs first**: audit and fix evidence-backed reliability,
correctness, maintainability, and UI issues. The features below are deferred.

Priority investigation areas:

1. Slow or stalled loading, including group counts temporarily reporting zero
   and games sometimes failing to load until a page refresh.
2. Voting sessions unexpectedly closing when someone enters before voting,
   including automatic phase transitions and concurrent participants.
3. Games tagged as party or short appearing as submission candidates despite
   not appearing in the group collection. Investigate current filtering and
   existing pool data separately; do not assume the cause.
4. UI quirks and broader code-quality problems with concrete user impact.

## Deferred feature requests

- **Group history search:** allow searching played games in a group's history
  so users can find when a game was last played without scrolling.
- **Expandable floating action button and navigation:** replace the existing
  add-game FAB with an initially closed upward arrow that expands to add-game,
  settings, and profile/analytics actions. The settings action should open the
  current Profile page; the profile action should open personal analytics.
  Remove their two corresponding bottom-navigation icons, leaving three.
  Preserve the existing visual language and accessibility. This is an explicit
  requested departure from the design reference's current navigation guidance;
  document the final rationale and any further decisions when implemented.

## Review and validation process

1. Review independent functional areas against the code and project guidance.
2. Categorize and cross-check findings, including interactions between fixes.
3. Implement scoped fixes, add regression coverage where practical, and run
   relevant checks. Record any unverified behavior and environment limitations.
4. Have the relevant reviewer re-review each fix; repeat for actionable
   findings until that review reports none or a blocker is documented.
5. Summarize decisions, changes, user impact, and remaining risks below. Record
   any departure from existing project guidance with its rationale.

## Findings and change log

This log records verified changes and remaining follow-up. User-reported
symptoms above are not all confirmed root causes.

### Baseline checks

- Production build passed. Vite reported a 775.92 kB minified JavaScript chunk
  and recommended considering code splitting; this alone does not establish
  the cause of the reported loading failures.
- Lint failed before any code changes: 21 errors and 3 warnings, including
  unused imports and React hook lint violations. These are baseline issues,
  not proof that every reported hook pattern is a user-visible defect.
- At the audit baseline, Firestore emulator tests passed 16 of 17 tests. The
  failing test expected collaborative metadata edits, contrary to the intended
  creator/administrator-only policy. The rules, UI guards, and focused
  regression tests now enforce creator or `admins/{uid}.isAdmin == true`
  metadata editing; signed-in rating aggregate updates remain separate.
- The older [security audit report](../SECURITY_AUDIT_REPORT.md) also
  recommended restricting metadata edits. That policy is now implemented and
  should remain consistent across rules, UI, tests, and documentation.

### Tag eligibility decision

The original setting explicitly hid tagged games from the collection display
only. The audit established that submissions use the unfiltered shared games
and voting also incorporates active pool entries. On November 10, 2026, the
user chose to extend the existing hidden-tag setting to exclude matching games
from new submissions and voting candidates as well. This intentionally changes
the previous display-only behavior; the settings wording and relevant guidance
must be updated with the implementation. Existing pool records and their
statistics must not be deleted automatically. Existing open sessions need
careful handling rather than retroactively changing their candidate snapshots.

### Findings under review

- Group loading can become stuck after membership confirmation times out;
  collection and member displays can show empty values before initial snapshots
  have loaded. Older asynchronous group-list reads may overwrite newer results.
- Every group-game snapshot can trigger a read of every owner marker when
  managing group games. This is a potential scaling cost; measure it separately
  before claiming an improvement.
- Automatic vote closure has a failure-retry defect and can race a new member
  joining; concurrent session starts can create inconsistent active sessions.
  Atomic membership and closure semantics require additional design work.
- Repeated group-creation clicks, unsurfaced profile save errors, missing form
  labels, and incomplete modal/navigation accessibility affect the UI.
- Historical active pool entries can refer to games with no remaining owners.
  Treat eligibility filtering and historical data repair as separate actions.

### Implemented changes

- **Game edits:** the initial collaborative-edit change was superseded by the
  user's clarification: only the game creator or an application administrator
  may edit global game metadata. Rules and the UI enforce that policy.
- **Session start and retry:** session creation now claims the active-session
  pointer and creates its vote in one transaction. Automatic close retries
  failures before the close commits. Unit tests cover the retry guard and an
  emulator test exercises two concurrent session starts. A subsequent change
  makes close side effects and matching metadata updates transactional, and
  recovers metadata left behind by the earlier split close. A re-review found
  additional risks: ballots can arrive after the tally snapshot; opening a vote
  and updating metadata were separate operations; and legacy active sessions
  without a session index could fail to close. A follow-up makes opening and
  its metadata update atomic and supports the missing-index case. Focused
  re-review found no regression in those fixes. The ballot-tally race remains
  unresolved.
- **Loading:** membership confirmation retries after transient failures and
  displays a retryable error. Initial snapshot readiness is tracked separately
  from empty collections, and stale group-list results are discarded.
  Unit tests cover the retry and latest-request helpers. The wiring was
  reviewed, but full authenticated end-to-end testing remains outstanding.
- **Forms:** group creation and profile saves guard against repeated requests;
  profile save failures are displayed, and form fields have accessible labels.
  A UI reviewer found no actionable regressions in these component changes.
- **Hidden tags and voting eligibility:** the submission picker and submission
  transaction exclude games with hidden tags. New voting snapshots exclude
  hidden games and games absent from the materialized group collection. Existing snapshots,
  pool entries, and statistics are not rewritten. Firestore rules also reject
  hidden-tag submissions and pool activation; candidate-list enforcement is
  client-side, and legacy tag casing can differ from normalized client tags.
  Reviews identified that initial rules blocked historical result corrections
  for hidden or removed previous winners, including for moderators and
  historical vote creators. A follow-up updates the play and pool atomically
  and permits restoration linked to a matching closed play. Follow-ups handle
  mismatched effective winners and legacy play fields, and require a
  rules-verifiable effective winner when restoring hidden historical winners.
  A no-winner correction with nonempty result rows is rejected when its hidden
  or missing previous winner cannot be safely restored.
- **Test entry points:** `npm run test:unit` runs the new loading and session
  reliability and hidden-tag unit tests; `npm run test:rules` includes
  session-creation race and hidden-tag coverage. Rules suites run sequentially
  because they clear the same emulator project.

Loading changes passed the latest independent re-review. Shared-modal focus
handling and navigation announcements have been updated and passed a focused
re-review. The voting reviewer confirmed the remaining candidate-enforcement
limitation described below; the audit is not a clean bill of health.

### Remaining risks and follow-up

- **Accepted ballots can be omitted:** ballots are read before the close
  transaction. A ballot accepted after that read but before close commits can
  be left out of the result. Firestore's web transaction API cannot lock a
  ballot query; a coordinated ballot/close protocol and rules changes are
  needed. Do not interpret the transactional close as a fix for this race.
- **Voter membership can change during closure:** a new member may join after
  the all-voted check. A precise, server-enforced eligible-voter policy is
  needed to eliminate that race. The user confirmed current membership at
  closure is the intended electorate and deferred adding Cloud Functions.
- **Submissions can change during opening:** the submission snapshot is read
  before the vote-opening transaction; a concurrent accepted submission can
  miss the resulting candidate snapshot.
- **Previously split session metadata:** an already-open vote with metadata
  still marked collecting is not automatically repaired. Avoid manual production
  data changes until a safe repair is designed.
- **Eligibility enforcement:** candidate lists are filtered in the client but
  not validated against hidden tags by Firestore rules. Rules compare stored
  tag strings directly, so noncanonical legacy tags can also bypass server-side
  submission checks. No production data was inspected or modified.
- **Performance:** owner markers are still read once per game after each
  group-game update. No live load-time measurements were available, so the
  work does not establish a quantitative speedup. The production JavaScript
  bundle remains above Vite's recommended chunk threshold.
- **Owner-marker consistency:** eligibility uses the materialized owner count;
  stale counts can admit a game with no remaining owner. Rules do not validate
  an entire candidate snapshot against owner markers or hidden tags.
- **UI validation:** automated checks cover the modal helper and navigation
  markup, not full authenticated workflows. A final browser smoke test was
  blocked by a browser connection timeout.

### Integration verification

- `npm run test:unit`: 25 tests passed on follow-up.
- `npm run test:rules`: 66 tests passed against the local demo Firestore
  emulator. No production data was used.
- `npm run build`: passed; the main JavaScript chunk was 795.03 kB minified
  (232.09 kB gzip). The original baseline was 775.92 kB minified, so this is
  not a measured bundle-size or loading-speed optimization.
- `npm run lint`: passed on follow-up; the original baseline had 21 errors
  and 3 warnings.
- No production deployment, migration, pool cleanup, or destructive data repair
  was performed.
