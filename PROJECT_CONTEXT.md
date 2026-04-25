Project Context — Board Game App

Document Marker (Context Changelog)

- Last verified: 2026-04-25
- Verification baseline: code + rules + recent history through commit 1ec5e8c
- Policy note: Game metadata editing is intentionally collaborative for now (not yet owner-restricted by design).
- Latest doc refresh highlights: roadmap/status alignment after shipping group statistics v1, participant-aware session tooling, vote-result override, custom session metrics, token counters, and guest-aware analytics aggregation.

Overview

This project is a React + Firebase board game application intended to move beyond a private hobby app into a stable, scalable product that can support broader real-world usage and potentially future monetization.

The app already has a mostly functional feature set and is no longer in an early prototype phase. The current priority is shifting from "learning while building" toward:
	•	improving maintainability
	•	reducing tech debt
	•	making future feature work faster and safer
	•	preparing the codebase for larger usage
	•	enabling structured AI-assisted development workflows (Copilot / Codex)

This document is intended to help any coding agent or collaborator understand the current state of the project, the development philosophy, the known architectural patterns, and the immediate priorities.

⸻

Product Goal

The app is a social board game tracker and group coordination tool.

At a high level, users should be able to:
	•	manage their board game collection
	•	browse/search games
	•	rate games
	•	create and join groups
	•	share games inside groups
	•	vote on games within groups
	•	view game and group details
	•	manage personal profile-related information
	•	view personal analytics and stats across all groups

The long-term goal is for the app to feel polished enough to be used beyond a small friend group, with better UX, stronger data consistency, and a codebase that can evolve without becoming fragile. A premium subscription tier is planned for monetization, with personal analytics being the first candidate for premium gating in a future phase.

⸻

Core App Flow

The current product flow is centered around a few core user journeys:
	•	users sign in and access their personal app state
	•	users browse/search games and inspect game details
	•	users build and manage their personal board game collection
	•	users rate games and maintain profile-related preferences/data
	•	users create groups or join existing groups
	•	once inside a group, users can view members, shared games, and group details
	•	group-related flows include sharing collection data into the group context and participating in game selection or voting flows
	•	users can move between personal collection management, group coordination, game detail views, and personal analytics depending on the current task

This flow is important context for contributors: the app is not just a collection tracker or just a voting tool. It combines personal collection management with collaborative group decision-making.

⸻

Main Domain Concepts

The codebase revolves around a few main product/domain concepts:
	•	User — the authenticated person using the app, including guest participants who are real accounts but not full group members
	•	Game — a board game entity that can be searched, viewed, rated, collected, or shared
	•	Personal Collection Entry — a user-specific relationship to a game, such as owning it, rating it, or exposing it for group use
	•	Group — a collaborative space where multiple users coordinate around board game choices
	•	Group Member — a user's membership/permissions relationship to a specific group
	•	Session Participant — a user (member or guest) who participated in a specific played session; stored as UIDs in participantIds on play records
	•	Shared Group Game — a game that is visible or contributed within a group context
	•	Vote / Selection Flow — the mechanism a group uses to help decide what to play
	•	Play Record — a persisted record of a completed session under groups/{groupId}/plays/{playId}, containing resultMode, playedGameIds, winnerGameId, placements, participantIds, metrics, and playedAt

These concepts may not yet be perfectly separated in code, but they should be treated as distinct responsibilities when reviewing or refactoring the app.

⸻

Known Sensitive Flows

The following areas should be treated as high-sensitivity flows where regressions are especially likely:
	•	group join flows, especially membership creation and first-time access after joining
	•	collection-to-group synchronization behavior
	•	listeners that depend on server-confirmed documents existing before subscription logic runs
	•	shared game visibility inside groups
	•	voting/session-selection flows that depend on synchronized group state
	•	any logic that mixes top-level UI state changes with async Firestore updates
	•	the useUserAnalytics hook, which maintains multiple parallel onSnapshot subscriptions across groups and must clean up all listeners correctly on userId change or unmount

Contributors and AI agents should be especially careful when changing these areas. Preference should be given to incremental, well-scoped changes with explicit attention to async ordering, cleanup, and data consistency.

⸻

Current Tech Stack
	•	Frontend: React
	•	Backend / Data: Firebase / Firestore
	•	Styling: CSS files and component-level styling patterns already present in the project
	•	Project structure: Component-based React app with multiple feature panels and detail views

Key known files/components in the current project include:
	•	App.jsx
	•	main.jsx
	•	firebase.jsx
	•	GameCard.jsx
	•	VotingPanel.jsx
	•	GroupsPanel.jsx
	•	GameTile.jsx
	•	GameDetail.jsx
	•	StarRating.jsx
	•	CollectionToggle.jsx
	•	GroupDetail.jsx
	•	GroupSettingsPanel.jsx
	•	AddGameForm.jsx
	•	ProfileCard.jsx
	•	GameImage.jsx
	•	UserAnalyticsPanel.jsx
	•	shared UI helpers such as Card.jsx, Fab.jsx, Toast.jsx
	•	emailExport.js

Key hooks include:
	•	useGroupSessionHistory.js — loads raw play records for a specific group
	•	useUserAnalytics.js — cross-group personal analytics aggregation hook (see notes below)
	•	useMyCollection.js — user's personal collection entries
	•	useMyRatings.js — user's game ratings

There are also global CSS files such as:
	•	index.css
	•	App.css

Firestore configuration files:
	•	firestore.rules — source of truth for security rules, deployed via Firebase CLI
	•	firestore.indexes.json — source of truth for index configuration, deployed via Firebase CLI

⸻

Development History / Important Context

This project started as a learning-oriented React app. Because of that, some implementation choices may reflect incremental growth rather than a clean architecture from day one.

Recent work has included:
	•	collection and group synchronization logic
	•	handling group joins and membership-related permission issues
	•	shared game visibility inside groups
	•	voting flow updates
	•	listener gating / server-sync timing concerns
	•	improving "Manage My Games" discoverability and UX
	•	moving toward safer incremental changes in App.jsx
	•	the first complete UI/UX overhaul pass across the major top-level screens
	•	migration of the main app shell to mobile-first bottom navigation with responsive desktop shell treatment
	•	profile avatar selection using bundled default avatars and future-ready avatar asset support
	•	group-level tag rules for hiding tagged games from Group Collection
	•	surfacing avatars in session results and history presentation
	•	addition of a new Tools tab in Group Detail
	•	implementation of Tools v1 seat randomizer and evolution to session-participant-aware randomization (members + guests)
	•	addition of Tools v2 token counters with local persistence
	•	introduction of past-session editing from the History tab for correcting saved session records
	•	completion of owner/moderator/creator-based play-record edit permissions in Firestore rules
	•	manual vote-result override flow ("Edit results") for post-close corrections
	•	custom numeric session metrics support in both closed-session and past-session editors
	•	group statistics v1 (overview, most played, player results, medal table, co-op rate)
	•	implementation of the personal Analytics tab (see Post-Stabilization Status below)
	•	analytics expansion to full cross-group + guest participation coverage with deduped play aggregation

A recurring theme is that the app functionally works, but parts of the code have likely become too centralized or too intertwined, especially in top-level orchestration logic.

⸻

Current Product Priorities

The roadmap priority order is:
1. Focused feature work on top of the stabilized and overhauled codebase
2. Analytics/statistics iteration — personal analytics and group statistics v1 are shipped; next is depth, quality, and public profile surfaces
3. Product-release readiness work (permissions policy alignment, storage/media, deployment readiness, regression coverage)
4. Future scaling and monetization-oriented improvements (premium tier, subscription gating)

Important: the project is no longer primarily in a cleanup-first phase. The current priority is to build on the now-stabilized and overhauled foundation with focused feature work, analytics, and release-readiness follow-up.

⸻

Known Product Direction

After the audit, the plan is to continue with:
	•	specific bug fixes and small post-overhaul polish
	•	analytics/statistics feature continuation (public profiles, deeper analytics, and iterative improvements on shipped stats surfaces)
	•	product-release readiness work
	•	later monetization/business-model exploration — a premium subscription tier (modeled loosely on Letterboxd's approach) is the intended direction, with personal analytics as the first candidate for gating

⸻

Post-Stabilization Status

The project has completed an initial stabilization and maintainability pass focused on reducing risk before new product work and UI overhaul planning.

Completed work includes:
	•	creation and refinement of this project context file
	•	an initial architecture / maintainability audit
	•	extraction of multiple read-only Firestore subscription flows from `App.jsx` into focused hooks
	•	centralization of workflow/status/tab constants
	•	cleanup of remaining hook dependency suppressions
	•	removal of clearly unused components/imports
	•	group access / group selection hardening
	•	collection-to-group sync hardening, especially around owner count invariants
	•	voting/session lifecycle hardening
	•	hook reset-on-gate-off fixes to prevent stale state bleeding across group/session/user changes
	•	a second follow-up audit after the stabilization work
	•	implementation of explicit "No Submission" support during the collecting phase, including submission-state editing before voting opens
	•	landing-page sign-in flow fix so the initial sign-in path now routes correctly into the working authentication flow
	•	introduction of the first session-history / played-session tracking foundation using persisted play records keyed by vote/session
	•	creation of a local firestore.rules source of truth in the repo and wiring it into Firebase project configuration
	•	completion of a major UI/UX overhaul pass across the app shell and major user-facing screens
	•	bottom navigation for mobile plus desktop-specific shell treatment
	•	overhaul of Library, My Collection, Game Detail, Groups, Group Detail shell, Voting, History, and Profile presentation
	•	addition of a dedicated History tab in Group Detail and cleanup of duplicated history/archive presentation
	•	profile avatar support using bundled default avatars with modal-based selection
	•	first version of group-level tag rules via hidden tags in Group Collection
	•	avatar usage in session results and history displays
	•	addition of a dedicated Tools tab in Group Detail
	•	implementation of the first Tools feature: seat randomizer
	•	implementation of past-session editing from the History tab
	•	initial support for correcting saved played date, selected/played games, result mode, and placements on past sessions
	•	implementation of the personal Analytics tab as a dedicated top-level navigation tab
	•	creation of useUserAnalytics.js hook for cross-group analytics aggregation
	•	creation of UserAnalyticsPanel.jsx for analytics presentation
	•	analytics sections: sessions, games played, placements/results (win rate + podium rate + medals), co-op record, game types (tag-based), rated games
	•	guest participant analytics support via collectionGroup plays query and extended Firestore read rules
	•	bottom nav switched to icons-only on mobile to support five tabs cleanly
	•	firestore.indexes.json added as source of truth for index configuration
	•	Group Statistics v1 surface in Group Detail (Statistics tab)
	•	medal-table expansion for group statistics
	•	session participant model hardening: participantIds used across history, placements, tools, and analytics
	•	seat randomizer upgraded to use session participants (including guests) with avatar-aware rendering
	•	guest account lookup by exact user ID for session participant management
	•	token counters tool added under Group Detail → Tools
	•	custom session metrics capture/edit support in VotingPanel and PastSessionEditModal
	•	vote result override editor for closed sessions (manual corrections without mutating ballot docs)
	•	Firestore rules hardening: game delete ownership check, role enum validation, and constrained play-record edits

The codebase is now considered stable enough to move out of the cleanup-first phase and into targeted product work, while still preferring focused patches over broad rewrites.

⸻

Analytics Tab — Architecture Notes

The personal Analytics tab is implemented as a dedicated top-level tab (APP_TAB.ANALYTICS) in the bottom navigation.

Key implementation details contributors should know:

Data layer (useUserAnalytics.js):
	•	Subscribes to users/{uid}/groups to discover the user's group memberships
	•	Subscribes to plays per group filtered by participantIds array-contains userId for member sessions
	•	Also runs a collectionGroup("plays") query filtered by participantIds array-contains userId to capture sessions where the user was a guest participant in a group they are not a member of
	•	Both paths are merged and deduplicated by groupId:playId composite key
	•	Subscribes to the global /games collection to resolve game titles and tags
	•	Subscribes to users/{uid}/collection and the ratings collection for rated games
	•	All analytics are computed client-side via useMemo from raw play records — no persisted rollups exist
	•	The hook follows the same Map/Set aggregation pattern as GroupStatisticsPanel.jsx

Firestore requirements:
	•	The plays collectionGroup query relies on Firestore's automatic single-field index on participantIds (no manual composite index needed)
	•	firestore.rules extends the plays read rule to allow reads by users listed in participantIds, not just group members
	•	Both rules and indexes are deployed via: firebase deploy --only firestore

Tag-based game types:
	•	Tags are stored on game records (/games), not on session/play records
	•	The hook joins playedGameIds against game records to resolve tags at read time
	•	Games with no tags are handled silently — they contribute to session/game counts but are excluded from the type breakdown
	•	A future QoL feature will add mandatory default tags to all games via the AddGameForm, which will naturally improve tag coverage over time without requiring changes to the analytics layer

Monetization note:
	•	The Analytics tab is currently fully unlocked for all users
	•	A premium/free split is planned for a future phase once the feature is validated with real usage
	•	The intended model is a cheap annual subscription (similar to Letterboxd), with deeper analytics and public profiles as the premium offering
	•	No paywall infrastructure exists yet — do not add gating logic until the subscription system is designed

⸻

Current Product Roadmap

1. Analytics / Statistics (active iteration)
	•	Shipped:
		•	personal analytics tab (cross-group + guest sessions)
		•	group statistics v1 tab (overview, most played, participant results, medals, co-op rate)
	•	Next analytics priorities:
		•	public player profiles — let other users view your analytics via group click-through
		•	privacy toggle for public/private profile
		•	deeper metric surfaces and trend views
		•	future: premium gating of analytics depth

2. Session Participants / Guest Support
	•	Guest users are real authenticated accounts that participate in sessions without being full group members
	•	Their UIDs are stored in participantIds on play records identically to members
	•	Analytics now correctly captures guest session data via the collectionGroup query path
	•	Delivered in v1:
		•	placements/results UI uses session participants
		•	seat randomizer uses session participants
		•	history surfaces participant badges and guest labeling
	•	Remaining guest-related work:
		•	UX polish and safeguards around participant search/add flow
		•	quality-of-life improvements for large groups and repeated guest usage

3. Group-Level Rules / Permissions Follow-Up
	•	Group hidden-tag rules have been implemented in a first version
	•	Session-history/result editing constraints are implemented in rules (owner + moderator + creator)
	•	Group member role validation enum is implemented in rules
	•	Game delete ownership is implemented in rules
	•	Remaining permissions follow-up is mainly policy alignment and review, not first-pass implementation
	•	Any permissions work should be treated as focused post-overhaul product hardening

4. Identity / Media Follow-Up
	•	Profile avatars are implemented using bundled default avatar assets
	•	Likely future follow-up:
		•	group imagery/banners
		•	expanded avatar pack / art direction cleanup
		•	image/media storage decisions for a productized release
	•	Keep lightweight until launch direction is clearer

5. Release Readiness
	•	Light regression testing across overhauled flows
	•	Permissions review
	•	Storage/media decisions
	•	Deployment/store-readiness planning
	•	Small post-overhaul polish fixes

6. Monetization
	•	Premium subscription tier (annual, low cost — Letterboxd model)
	•	Personal analytics is the first candidate feature for premium gating
	•	Public profiles are a strong second candidate
	•	No implementation until product shape and launch readiness are confirmed

7. Mobile-App Readiness
	•	The app has a strong mobile-first shell and is a realistic Capacitor candidate
	•	Continue polishing the web app first, then evaluate mobile packaging
	•	Not the immediate implementation priority

⸻

Current Development Strategy

The preferred sequence is now:
	1.	validate and iterate on shipped analytics/statistics surfaces with real usage data
	2.	design and implement public player profiles with privacy controls
	3.	continue participant/guest UX refinement and data-quality hardening
	4.	review release-readiness gaps (permissions policy alignment, regression coverage, deployment/media decisions)
	5.	prepare monetization gating only after product shape stabilizes

The styling/tooling foundation has now been established well enough to support the completed overhaul pass, but future contributors should still prefer extending the shared design-system primitives rather than reintroducing ad hoc one-off styling.

⸻

Expectations for Any Contributor or AI Agent

Before changing code:
	•	understand the existing flow first
	•	avoid inventing architecture that does not fit the codebase
	•	prefer extraction/refinement over large rewrites
	•	preserve Firebase behavior carefully
	•	document risks when touching shared state or synchronization code

When suggesting improvements:
	•	be concrete
	•	reference actual files/components
	•	separate "must fix now" from "nice to have later"

When implementing:
	•	keep patches reviewable
	•	avoid mixing unrelated changes
	•	do not combine refactor + feature + style cleanup unless requested

⸻

Suggested First Copilot Task

Task: Audit the current codebase for maintainability, structure, and future scalability.

Intent: Identify the most important cleanup/refactor opportunities before continuing with new features and UI work.

Expected output:
	•	a structured report
	•	prioritized findings
	•	concrete file-level recommendations
	•	a staged refactor roadmap
	•	a clear do now / later / avoid for now breakdown
	•	no major code changes unless explicitly requested

Note:
	•	This task has already been completed during the initial stabilization phase and is preserved here as historical context for future contributors.

⸻

Current Known Follow-Up Items

The highest-value near-term follow-up items are now:
	•	validate both personal analytics and group statistics with real user data and fix edge cases
	•	design and implement public player profiles with group click-through discovery and privacy toggle
	•	iterate analytics depth (trend views, richer breakdowns, and/or longitudinal summaries)
	•	continue Session Participants v1 polish (lookup UX, repeated guest flows, larger-session ergonomics)
	•	review permissions policy alignment between client UX and Firestore rules where intent is still evolving
	•	continue small post-overhaul polish fixes only when concrete and high-value
	•	prepare a release-readiness checklist covering media, deployment, permissions, and launch needs
	•	plan the premium subscription tier once the feature set is stable enough to gate

These should be treated as the bridge between the shipped analytics/statistics foundation and the next product-maturity phase (public profiles, deeper analytics, release hardening, and monetization).