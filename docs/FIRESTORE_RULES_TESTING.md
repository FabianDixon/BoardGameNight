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
- Test file location: `tests/rules/firestore.rules.test.mjs`

## Covered baseline cases

- `/games/{gameId}`: collaborative metadata edits remain open; delete restricted to creator.
- `/groups/{groupId}/members/{userId}`: self profile sync allowed; self role escalation denied; owner role changes allowed.
- `/groups/{groupId}/plays/{playId}`: owner/moderator/creator edits allowed; normal member edits denied.
