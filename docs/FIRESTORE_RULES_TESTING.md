# Firestore Rules Testing (Emulator)

This project includes a minimal local Firestore security rules test harness using the Firebase Emulator.

## Prerequisites

- Node.js 20+
- Install dependencies:

```bash
npm install
```

## Run rules tests

```bash
npm run test:rules
```

Verbose reporter:

```bash
npm run test:rules:verbose
```

## Notes

- Tests run against the local Firestore Emulator only.
- The script uses a demo project ID (`demo-boardgame-night`), so it does not touch production/staging data.
- Rules under test: `firestore.rules`
- Tests: `tests/rules/firestore.rules.test.mjs`,
  `tests/session-creation.rules.test.mjs`, and
  `tests/hidden-tags.rules.test.mjs`. They run sequentially because they clear
  the same demo project's emulator data.

The separate `npm run test:unit` command runs loading, session reliability,
hidden-tag eligibility, game permissions, modal accessibility, group-history
search, and expandable-navigation tests without the emulator.

`npm run test:browser` runs the navigation and modal lifecycle regression in
headless Chrome. It requires Chrome and a Node.js version with native
`WebSocket` support; set `CHROME_BIN` if Chrome is not in a detected location.
The test reports a skip when either prerequisite is unavailable.

## Covered baseline cases

- `/games/{gameId}`: metadata edits and deletes are allowed only to the creator
  or an administrator (`admins/{uid}.isAdmin == true`); signed-in rating
  aggregate updates remain available separately.
- `/groups/{groupId}/members/{userId}`: self profile sync allowed; self role escalation denied; owner role changes allowed.
- `/groups/{groupId}/plays/{playId}`: owner/moderator/creator edits allowed; normal member edits denied.
