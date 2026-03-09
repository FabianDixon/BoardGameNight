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

A recurring theme is that the app functionally works, but parts of the code have likely become too centralized or too intertwined, especially in top-level orchestration logic.

⸻

Current Product Priorities

The roadmap priority order is:
1. Focused feature and bug tickets on top of the stabilized codebase
2. Targeted product improvements identified by product/design discussions
3. Major UI refresh / polish pass
4. Future scaling and monetization-oriented improvements

Important: the project is no longer primarily in a cleanup-first phase. The current priority is to build on the now-stabilized foundation with focused feature work and bug fixes before the major UI overhaul.

⸻

Known Product Direction

After the audit, the plan is to continue with:
	•	specific bug fixes
	•	specific features already identified outside this document
	•	a major UI update / polish pass

This means technical changes now should support future UI work rather than make it harder.

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

The codebase is now considered stable enough to move out of the cleanup-first phase and into targeted product work, while still preferring focused patches over broad rewrites.

⸻

Current Product Roadmap Before UI/UX Overhaul

Before starting a major UI/UX redesign, the next planned work is:

1. Submission Phase Improvement
	•	Allow a user to explicitly choose “No Submission” during the collecting phase.
	•	This should count as a completed submission-state for auto-advance purposes.
	•	Users should still be able to change from “No Submission” to a real game submission until voting opens.
	•	The UX should make it clear that “No Submission” is an intentional state change, not a failed action.

2. Landing Page Sign-In Bug Fix
	•	The sign-in path from the landing page currently does not work correctly.
	•	A workaround exists through guest mode → profile → sign in, but the main entry path should be fixed before shipping.

3. Session History / Played Session Tracking
	•	Add a data model and UI flow to record session history after a vote/session completes.
	•	Initial goals include:
		•	automatically logging the selected winner game
		•	allowing additional played games to be recorded
		•	allowing the played date to be recorded
		•	recording player placements / medals with support for ties, cooperative outcomes, or no winner
	•	This feature is intended to become the foundation for future history views, scoreboards, and play statistics.

4. Game Labels / Tags
	•	Add labels/tags to games so they can be filtered across the app.
	•	This should later support:
		•	filtering in multiple screens
		•	group-specific hiding or preference rules
		•	future statistics by tag/category

These items should generally be approached before the UI overhaul so that the redesign can account for the real product shape rather than forcing these features in later.

⸻

Current Development Strategy

The preferred sequence is now:
	1.	focused feature/bug tickets for the items above
	2.	confirm stability with light regression testing
	3.	plan the UI/UX overhaul using the updated feature set and data model

The project is no longer primarily in a “cleanup first” phase. Remaining technical cleanup should be driven by concrete upcoming work rather than general architectural ambition.

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
