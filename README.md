# 🎲 Board Game Night

A lightweight web app to help friends organize board game nights:
- Build a shared game library
- Keep your personal collection
- Create groups and see the group’s combined collection
- Run voting sessions (collect submissions → vote → pick winner)
- Track a persistent “pool” of candidates with weighting support
- Export session data (JSON) for analysis/tuning

## Live App
- Hosted on Firebase Hosting
- `https://boardgamenight-5863e.web.app`

---

## Features

### Library
- Global game catalog with title, description, image URL
- Star ratings (0.5 increments)

### My Collection
- Add/remove games from your personal collection
- Search collection

### Groups
- Create / join groups (invite code)
- Materialized group collection (union of members’ collections)
- Group settings (weights overrides)

### Voting Sessions
- Session workflow:
  1. Start session (collecting)
  2. Members submit 1 game (can change submission until voting starts)
  3. Start voting (candidates snapshot)
  4. Members cast secret ballots
  5. Close vote (weighted winner from voted games only)
- Winner becomes inactive in the pool until re-submitted
- Plays log written on win
- Export JSON of session inputs/outputs for analysis

---

## Tech Stack
- React (Vite)
- Firebase Authentication
- Cloud Firestore
- Firebase Hosting
- Tailwind CSS (plus a couple inline style fallbacks for Safari edge cases)

---

## Data Model (high level)
- `games/{gameId}`: global game catalog
- `users/{uid}`: user profile (nickname, etc.)
- `users/{uid}/collection/{gameId}`: personal collection
- `groups/{groupId}`: group metadata
- `groups/{groupId}/members/{uid}`: membership
- `groups/{groupId}/games/{gameId}` + `owners/{uid}`: materialized group union
- `groups/{groupId}/votes/{voteId}`: sessions
- `groups/{groupId}/votes/{voteId}/submissions/{uid}`: one submission per user per session
- `groups/{groupId}/votes/{voteId}/ballots/{uid}`: ballots (open phase only)
- `groups/{groupId}/pool/{gameId}`: persistent queue + stats
- `groups/{groupId}/plays/{playId}`: play history
- `groups/{groupId}/settings/weights`: group weight overrides

---

## Contributing / Feedback
Issues are welcome for:
- Bug reports
- Feature requests
- UX suggestions

Please include:
- Steps to reproduce (bugs)
- Expected vs actual behavior
- Screenshots if relevant
- Browser/device info
- Console errors (if any)

See `CONTRIBUTING.md`.

---

## License
MIT.
