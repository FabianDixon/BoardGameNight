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
	•	SearchInput.jsx
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
	•	TopTabs.jsx
	•	ProfileCard.jsx
	•	ProfileTab.jsx
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
	1.	Code audit / technical cleanup planning
	2.	Bug fixes
	3.	New features already identified by product/design discussions
	4.	Major UI refresh / polish pass

Important: current priority is not feature brainstorming from scratch. It is improving the foundation so future work is easier, safer, and faster.

⸻

Immediate AI-Assisted Workflow Goal

The user wants to begin using GitHub Copilot / Codex as implementation assistants for this project.

This means tasks should be prepared in a way that works well for AI coding agents:
	•	clear scope
	•	explicit constraints
	•	known files to inspect
	•	acceptance criteria
	•	preference for minimal, focused patches
	•	avoid unnecessary rewrites unless justified

Copilot/Codex should be used for:
	•	code audits
	•	targeted refactors
	•	feature patches
	•	bug-fix implementation
	•	structured suggestions tied to actual files

⸻

Working Style Preferences

When proposing changes, follow these principles:

1. Prefer focused patches over broad rewrites

Do not rewrite large parts of the codebase unless there is a strong architectural reason.

2. Preserve working behavior

The app is already mostly functional. Avoid risky refactors that could break existing behavior unless the task explicitly allows it.

3. Be explicit about tradeoffs

When suggesting refactors, explain:
	•	why the current pattern is risky or costly
	•	what the proposed structure improves
	•	what migration risk exists

4. Optimize for future maintainability

Good solutions should make future features easier to add and reduce coupling.

5. Keep React patterns sound

Pay attention to:
	•	hook usage order
	•	dependency arrays
	•	derived state vs stored state
	•	listener cleanup
	•	memoization only where useful
	•	preventing unnecessary re-renders

6. Respect Firebase realities

Any proposal touching Firestore must consider:
	•	permission rules
	•	async consistency
	•	listener timing
	•	optimistic vs server-confirmed state
	•	failure modes during joins/sync operations

⸻

Suspected Technical Debt Areas

These are working assumptions and should be validated during audit:

1. App.jsx may be overloaded

There is a high likelihood that App.jsx currently owns too much orchestration logic, state wiring, and cross-feature coordination.

The current architectural reality is that some flows are still coordinated from the top-level app shell rather than through clearly separated feature modules or custom hooks. Contributors should assume that top-level orchestration is part of the current design and should improve it incrementally rather than replacing it wholesale.

Potential symptoms:
	•	too many responsibilities in one file
	•	difficult-to-track state flow
	•	high regression risk from small changes
	•	repeated logic for data transformations or access checks

2. Mixed domain responsibilities

Game collection logic, group membership logic, voting logic, UI routing/tab logic, and sync logic may be too interwoven.

3. Firestore listeners and async sequencing

Some bugs suggest issues related to:
	•	listeners starting before data is ready
	•	joining groups before membership docs are fully available server-side
	•	collection/group sync operations racing each other
	•	permission-denied errors caused by timing rather than pure rule failure

4. UI discoverability / view structure

At least one UX issue already identified: the Manage My Games area was hard to find because it rendered too far down in an existing view instead of behaving like a clearer primary screen/panel.

5. Reusability / consistency gaps

There may be opportunities to consolidate repeated patterns across:
	•	cards/tiles
	•	detail panels
	•	group/game display logic
	•	toasts / empty states / loading states

6. Future scalability concerns

Before broader usage, the app likely needs review for:
	•	query efficiency
	•	render efficiency
	•	state ownership clarity
	•	component boundaries
	•	easier testability

⸻

What a Good Audit Should Cover

The first requested AI task should perform a code audit focused on maintainability, structure, and optimization, not on adding new features.

The audit should inspect the current codebase and produce findings in categories like:

A. Architecture / File Responsibilities
	•	which files are overloaded
	•	whether responsibilities are well separated
	•	candidates for extracting hooks, utilities, or feature modules

B. React State Management
	•	duplicated state
	•	derived state that should not be stored
	•	prop drilling issues
	•	stale closures / hook dependency issues
	•	unnecessary memoization or missing memoization where it matters

C. Firebase / Firestore Integration
	•	duplicated query/listener logic
	•	unsafe async flows
	•	missing cleanup
	•	race conditions
	•	permission-related fragility caused by timing/order of operations

D. Component Design
	•	oversized components
	•	poor reusability
	•	presentation vs logic separation
	•	opportunities for shared UI primitives

E. Performance
	•	expensive renders
	•	repeated mapping/filtering in render
	•	missing memoization for expensive derived lists
	•	excessive listeners or unnecessary data fetches

F. Maintainability / DX
	•	naming consistency
	•	dead code
	•	hard-coded strings
	•	magic constants
	•	areas where comments or helper abstractions would help

G. Safe Refactor Suggestions

Recommendations should be prioritized as:
	•	High impact / low risk
	•	High impact / medium risk
	•	Later / optional

The audit should not immediately rewrite code. It should first identify issues and suggest a staged cleanup plan.

⸻

Desired Format for Copilot/Codex Tasks

When generating implementation prompts for coding agents, use this template style:

Task Structure
	1.	Goal — what to improve or fix
	2.	Context — why the change matters
	3.	Files to inspect first
	4.	Constraints — what must not be broken
	5.	Implementation guidance — preferred approach
	6.	Deliverable — audit, patch, refactor, etc.
	7.	Acceptance criteria

Prompt Tone

Use prompts that encourage:
	•	minimal safe diffs
	•	evidence-based analysis after reading files
	•	no speculative rewrites
	•	preserving current behavior
	•	explaining rationale before patching

⸻

Known Product Direction

After the audit, the plan is to continue with:
	•	specific bug fixes
	•	specific features already identified outside this document
	•	a major UI update / polish pass

This means technical changes now should support future UI work rather than make it harder.

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

⸻

Notes for Future Updates to This Document

This file should be updated when:
	•	major architecture changes are made
	•	state management approach changes
	•	Firestore schema/rules assumptions change
	•	new core modules are introduced
	•	the UI overhaul begins
	•	monetization-related constraints appear

It should remain a practical onboarding/context file, not a long historical diary.