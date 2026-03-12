Project Context — Board Game App

Overview

This project is a React + Firebase board game application intended to move beyond a private hobby app into a stable, scalable product that can support broader real-world usage and potentially future monetization.

The app already has a mostly functional feature set and is no longer in an early prototype phase. The current priority is shifting from “learning while building” toward:
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

The long-term goal is for the app to feel polished enough to be used beyond a small friend group, with better UX, stronger data consistency, and a codebase that can evolve without becoming fragile.

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
	•	users can move between personal collection management, group coordination, and game detail views depending on the current task

This flow is important context for contributors: the app is not just a collection tracker or just a voting tool. It combines personal collection management with collaborative group decision-making.

⸻

Main Domain Concepts

The codebase revolves around a few main product/domain concepts:
	•	User — the authenticated person using the app
	•	Game — a board game entity that can be searched, viewed, rated, collected, or shared
	•	Personal Collection Entry — a user-specific relationship to a game, such as owning it, rating it, or exposing it for group use
	•	Group — a collaborative space where multiple users coordinate around board game choices
	•	Group Member — a user’s membership/permissions relationship to a specific group
	•	Shared Group Game — a game that is visible or contributed within a group context
	•	Vote / Selection Flow — the mechanism a group uses to help decide what to play

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
	•	shared UI helpers such as Card.jsx, Fab.jsx, Toast.jsx
	•	emailExport.js

There are also global CSS files such as:
	•	index.css
	•	App.css

⸻

Development History / Important Context

This project started as a learning-oriented React app. Because of that, some implementation choices may reflect incremental growth rather than a clean architecture from day one.

Recent work has included:
	•	collection and group synchronization logic
	•	handling group joins and membership-related permission issues
	•	shared game visibility inside groups
	•	voting flow updates
	•	listener gating / server-sync timing concerns
	•	improving “Manage My Games” discoverability and UX
	•	moving toward safer incremental changes in App.jsx
	•	the first complete UI/UX overhaul pass across the major top-level screens
	•	migration of the main app shell to mobile-first bottom navigation with responsive desktop shell treatment
	•	profile avatar selection using bundled default avatars and future-ready avatar asset support
	•	group-level tag rules for hiding tagged games from Group Collection
	•	surfacing avatars in session results and history presentation

A recurring theme is that the app functionally works, but parts of the code have likely become too centralized or too intertwined, especially in top-level orchestration logic.

⸻

Current Product Priorities

The roadmap priority order is:
1. Focused feature work on top of the stabilized and overhauled codebase
2. Analytics/statistics design and implementation
3. Product-release readiness work (permissions, storage/media, deployment readiness, polish)
4. Future scaling and monetization-oriented improvements

Important: the project is no longer primarily in a cleanup-first phase. The current priority is to build on the now-stabilized and overhauled foundation with focused feature work, analytics, and release-readiness follow-up.

⸻

Known Product Direction

After the audit, the plan is to continue with:
	•	specific bug fixes and small post-overhaul polish
	•	analytics/statistics feature planning and implementation
	•	product-release readiness work
	•	later monetization/business-model exploration once the product shape is stable

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
	•	implementation of explicit “No Submission” support during the collecting phase, including submission-state editing before voting opens
	•	landing-page sign-in flow fix so the initial sign-in path now routes correctly into the working authentication flow
	•	introduction of the first session-history / played-session tracking foundation using persisted play records keyed by vote/session
	•	creation of a local firestore.rules source of truth in the repo and wiring it into Firebase project configuration
	•	completion of a major UI/UX overhaul pass across the app shell and major user-facing screens
	•	bottom navigation for mobile plus desktop-specific shell treatment
	•	overhaul of Library, My Collection, Game Detail, Groups, Group Detail shell, Voting, History, and Profile presentation
	•	addition of a dedicated History tab in Group Detail and cleanup of duplicated history/archive presentation
	•	profile avatar support using bundled default avatars with modal-based selection
	•	first version of group-level tag rules via hidden tags in Group Collection
	•	avatar usage in session results and history displays

The codebase is now considered stable enough to move out of the cleanup-first phase and into targeted product work, while still preferring focused patches over broad rewrites.

⸻

Current Product Roadmap After UI/UX Overhaul

Before starting a major UI/UX redesign, the next planned work is:

1. Analytics / Statistics
	•	This is now the highest-priority major product feature track.
	•	Planned first focus is group-facing statistics built from the existing session-history foundation.
	•	Likely early metrics include:
		•	total sessions played
		•	most played games
		•	most selected / winning games
		•	player win counts / placements
		•	co-op win/loss outcomes
		•	tag-based insights later once the core analytics layer exists
	•	Profile/user-facing statistics may follow after group statistics are established.

2. Group-Level Rules / Permissions Follow-Up
	•	Group hidden-tag rules have now been implemented in a first version.
	•	A likely follow-up is tightening permissions around session-history/result editing so this is limited to owner + moderator roles rather than broad member access.
	•	Any permissions work here should be treated as focused post-overhaul product hardening.

3. Identity / Media Follow-Up
	•	Profile avatars have now been implemented using bundled default avatar assets.
	•	Likely future follow-up work includes:
		•	group imagery/banners
		•	expanded avatar pack / art direction cleanup
		•	image/media storage decisions for a more productized release
	•	This should remain lightweight until launch direction is clearer.

4. Release Readiness
	•	The next non-feature planning phase should focus on what is required for an actual product release.
	•	This likely includes:
		•	light regression testing across the overhauled flows
		•	permissions review
		•	storage/media decisions
		•	deployment/store-readiness planning
		•	small post-overhaul polish fixes

5. Mobile-App Readiness
	•	The app now has a stronger mobile-first shell and is a realistic candidate for later wrapping as a mobile app.
	•	Current expectation is to continue polishing the web app first, then evaluate Capacitor-based mobile packaging later.
	•	This is considered viable, but is not yet the immediate implementation priority.

⸻

Current Development Strategy

The preferred sequence is now:
	1.	close any remaining small post-overhaul polish issues
	2.	run light regression testing on the overhauled app flows
	3.	design and implement the first analytics/statistics features
	4.	review release-readiness gaps before launch-oriented work

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
	•	separate “must fix now” from “nice to have later”

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
	•	run a light regression/testing pass across the newly overhauled app flows
	•	design and implement the first analytics/statistics surfaces, starting with group statistics
	•	review and tighten permissions around session-history/result editing if needed
	•	continue small post-overhaul polish fixes only when they are concrete and high-value
	•	prepare a release-readiness checklist covering media, deployment, permissions, and launch needs

These should be treated as the bridge between the completed overhaul phase and the next product-maturity phase (analytics, permissions hardening, release readiness, and later monetization exploration).
