# Changelog

All notable changes to FamilyTree Social are documented here.
Format: `[Version] — YYYY-MM-DD`

---

## [1.4.0] — 2026-05-09

### Added — Android App (React Native / Expo)
- New standalone Android app in `android-app/` directory targeting Android 7+ (Samsung S24+ optimised)
- SVG family tree visualisation with zoom controls (+ / − / reset) and nested scroll pan
- Bottom tab navigation: Home Feed · My Trees · Notifications · Profile
- **Setup screen** — enter server URL on first launch; validates connectivity before saving
- **Auth screen** — login and registration with tabbed UI matching the web app design
- **Trees screen** — list all trees with pull-to-refresh; create new tree (name, description, privacy)
- **Tree Detail screen** — three tabs: Tree visualisation / Members list / Social feed
- **Add Member screen** — add 1–6 members at once with full relationship fields (father, mother, spouse, birth/death year, place, bio); horizontal pill pickers for existing members
- **Member Detail screen** — view profile card, family relations, biography; inline edit mode with scrollable member pickers; delete with confirmation
- **Dashboard screen** — personalised social feed with heart reactions; quick-access stat cards
- **Profile screen** — edit display name & bio; sign out; links to Trees and Notifications
- **Notifications screen** — unread badge styling, mark-all-read, tap to navigate to relevant tree
- Auto token refresh via Axios interceptor; redirects to Auth on session expiry
- AsyncStorage persistence for server URL, JWT tokens, and user profile
- EAS Build config (`eas.json`) — `preview` profile outputs a direct-install APK
- Placeholder assets (icon, adaptive-icon, splash) in navy brand colour

### Added — Web App Features (earlier in this release cycle)
- **Subtree collapse** — click ⊖ on any node to hide all descendants (folder-style); collapsed nodes show ▶N badge with hidden count and a dashed border; click ▶ to expand
- **Combined Add Member modal** — single "+ Add Member" button opens a modal that starts with one full form; click "+ Add another member" to append up to 5 more entries (6 total); each entry has name, gender, birth/death year, birth place, father, mother, spouse, and bio fields
- **Full-height tree canvas** — tree scroll area now fills the window (`calc(100vh - 290px)`) with a `min-height: 420px` floor
- **Bulk add** (up to 6 members in one operation) with sequential API calls and partial-success reporting
- **Download PNG / PDF** — toolbar buttons export the current tree view
- **Lineage filter** — All / Paternal / Maternal toggle buttons in the tree toolbar
- **Minimize/maximize nodes** — subtree collapse hides all descendant nodes and edges

### Fixed
- Blank page crash: `App._addMemberEntry` and `App._removeMemberEntry` assigned at module level before the IIFE return value was available; converted to internal named functions exported in the return object
- Duplicate connection lines: each child previously drew separate gold (paternal) and purple (maternal) bezier curves; now draws one indigo edge from the couple midpoint when both parents are present
- One-directional spouse links: only one side stored `spouse_id`; fixed by building a bidirectional `spouseMap` across all members
- Same-person parent bug: `paternalParentId === maternalParentId` caused duplicate edges; fixed with `new Set([paternal, maternal].filter(Boolean))`
- Old `family-tree.html` depth calculation: BFS assigned depths before spouse sync; fixed with a single interleaved while-changed loop
- Old app Reset Layout button called `drawTree()` (undefined); changed to `render()`

---

## [1.0.0] — 2026-05-09 (initial public release)

### Added — Full-Stack Social Platform
- Node.js + Express REST API with SQLite (WAL mode, better-sqlite3)
- JWT authentication: 15-minute access tokens + 7-day refresh tokens (bcryptjs)
- Role-based access control per tree: owner / editor / viewer
- **Trees** — create, list, update, delete; privacy levels: public / family / private
- **Members** — full CRUD with paternal parent, maternal parent, spouse, birth/death year, birth place, bio, avatar upload (Multer, 5 MB limit)
- **Social feed** — posts (birth announcement, milestone, story, memory, update); heart reactions; threaded comments; 30-second notification polling
- **Invitations** — token-based invite links; accept/decline flow
- **Collaborators** — invite users to a tree with a specific role
- SPA frontend with hash-based routing (no framework); Navy `#1a2744` + Gold `#c9a84c` design system
- Interactive SVG tree visualisation: BFS layout, bidirectional spouse midpoint edges, zoom/pan, node tooltips
- Responsive member cards with gender-coloured avatars and initials
- `family-tree.html` — legacy single-file offline app (preserved for reference)
