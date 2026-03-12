Board Game Night — UI Design Reference

This document began as the UI overhaul brief and now serves as the post-overhaul design reference for Board Game Night. It describes the intended design language, current structural direction, and future visual/product follow-up areas.

1. Objective

Refine the app into a more polished, cohesive, product-ready experience without changing the core product flow.

This is a visual system + interaction refinement overhaul, not a ground-up product redesign.

The current flow is already good:
	•	Library
	•	My Collection
	•	Groups
	•	Group Detail
		◦	Collection
		◦	Voting
		◦	History
		◦	Settings
	•	Game Detail
	•	Profile

The overhaul should preserve that structure while improving:
	•	visual hierarchy
	•	consistency
	•	readability
	•	perceived quality
	•	identity/personality

⸻

2. Design direction

Core vibe

Dark-first, art-led, premium hobby app
Inspired by:
	•	Letterboxd mobile
	•	game database / catalog apps
	•	tabletop / board-game atmosphere

Visual tone
	•	dark charcoal surfaces
	•	cool neutrals with slight blue/green undertone
	•	restrained accent usage
	•	cover art should do a lot of the visual work
	•	clean metadata hierarchy
	•	chips/badges for state
	•	premium but not flashy
	•	cozy-geek, not corporate SaaS

⸻

3. Product principles for the redesign

A. Keep the current flow

Do not reinvent navigation or app structure unless something is clearly broken.

B. Art first

Game covers/images should feel like the hero of browsing.

C. Actions stay contextual

Actions should only appear in the tab/screen where they belong.

Examples:
	•	Group Collection → collection actions only
	•	Voting → session and vote actions only
	•	Settings → group rules/members/weights only

D. Dark-first consistency

Inputs, cards, modals, tabs, surfaces, and overlays should all feel like they belong to one system.

E. Metadata should feel elegant

Titles, subtitles, tags, ratings, counts, and secondary info should feel clean and layered, not stacked like admin UI.

⸻

4. Visual system

Base palette

Use a dark-first foundation with restrained accent colors.

Backgrounds
	•	app background: very dark charcoal
	•	primary surface: dark neutral
	•	secondary surface: slightly lighter elevated neutral
	•	raised card surface: layered dark panel

Text
	•	primary text: near-white
	•	secondary text: cool gray
	•	muted text: dimmer gray

Accent colors
	•	Blue: primary actions, active controls, links
	•	Green: collection states, positive/shared states, in-pool style states
	•	Red: destructive actions, leave/remove
	•	Yellow/Orange: ratings, winner highlights, high-attention badges

UI element families

Create a consistent style system for:
	•	buttons
	•	pills / segmented tabs
	•	chips / badges
	•	cards
	•	inputs
	•	modals
	•	list rows
	•	empty states

⸻

5. Identity assets

Profile avatars

Do not start with uploads.

Use:
	•	default selectable avatar set
	•	playful tabletop/geek icon style
	•	stored as avatar key/id

Suggested icon themes:
	•	meeple
	•	d20
	•	potion
	•	wizard hat
	•	dragon
	•	mimic chest
	•	raccoon gamer
	•	cat mage
	•	goblin
	•	tavern mug

Group identity

Prefer:
	•	optional group banner/image URL later
	•	or group icon/theme accent as an interim step

Groups should feel like social spaces or clubs, not plain rows.

⸻

6. Screen-by-screen design intent

Library

Intent: beautiful browseable catalog

Keep:
	•	search
	•	tag filtering
	•	card grid

Improve:
	•	stronger card hierarchy
	•	better art framing
	•	cleaner metadata below cover
	•	tighter action placement
	•	more premium filter/search row

My Collection

Intent: personal shelf

Should feel like:
	•	your curated games
	•	not just a filtered copy of library

Use same card system as library, but collection state should be visually stronger.

Groups list

Intent: social hub / groups list

Improve:
	•	“Create group” and “Join group” as clear top actions
	•	“Your groups” as polished cards/list rows
	•	make groups feel like places, not just names

Group Detail

Intent: command center for a game night group

Keep current structure:
	•	header
	•	segmented tabs
	•	Collection / Voting / History / Settings

Refine:
	•	stronger header
	•	cleaner invite code treatment
	•	better tab styling
	•	clearer separation between live Voting flow and archive History flow
	•	more consistent tab-specific actions (Voting = current session, History = past sessions)

Group Collection

Intent: shared shelf

This should feel like a group-curated shelf with:
	•	polished game tiles
	•	clear state chips (played / in pool / etc.)
	•	strong filtering controls
	•	not too much visual clutter

Voting / Session

Intent: current session console / event flow

This can become one of the most distinctive screens.

Needs:
	•	clear live session stage hierarchy
	•	stronger current-action area for in-progress decisions
	•	clean current-session result logging and placement editing
	•	event-like flow that focuses on what is happening now

History

Intent: archive of past group sessions

This should feel distinct from the live/current session flow.

Needs:
	•	readable session cards/timeline/archive presentation
	•	clear home for past results, played games, and placements
	•	stable structure that can grow into analytics/statistics surfaces later

Game Detail

Intent: hero entry page for a game

This should be the most art-led screen.

Structure:
	•	large hero image
	•	title
	•	tags / ratings / key metadata
	•	description
	•	actions
	•	collection/group/session relevance

Profile

Intent: identity + account + future activity

Keep simple for now:
	•	profile identity
	•	avatar identity selection (now part of the active profile direction)
	•	account/auth
	•	maybe lightweight personal stats later

Visually:
	•	premium panel
	•	clearer sections
	•	better input styling
	•	avatar identity should stay integrated but not over-dominant

⸻

7. What not to do
	•	Do not redesign everything at once blindly
	•	Do not let every screen invent its own card/input/button style
	•	Do not overload with too many accent colors
	•	Do not make filters visually noisy
	•	Do not add advanced product features during the visual overhaul unless necessary

⸻

8. Deliverable style for redesign work

Every redesign task should try to produce one of these:
	•	design-system primitives
	•	one screen overhaul
	•	one screen family overhaul
	•	one interaction refinement

Avoid mixing:
	•	visual overhaul
	•	feature work
	•	refactor work
in the same patch unless necessary

⸻

9. Post-overhaul status

The first major overhaul pass has been completed across the main top-level app surfaces.

Future work should extend the established design-system primitives rather than reintroduce ad hoc one-off styles.

Likely visual follow-up areas include:
	•	desktop shell polish
	•	richer identity/media expression
	•	analytics/statistics presentation patterns
