# FamilyTree Social

A family tree platform with social features — build your tree, invite relatives to collaborate, and share memories together.

---

## Quick Start

### Windows — double-click `start.bat`

That's it. No setup needed. The script automatically:
1. Installs Node.js if it's missing (uses `winget` or downloads the installer silently)
2. Installs app dependencies on first run
3. Starts the server
4. Opens `http://localhost:3000` in your browser

### Linux / Mac — run `start.sh`

```bash
./start.sh
```

If you see a "permission denied" error the very first time, run:
```bash
chmod +x start.sh && ./start.sh
```

The script automatically installs Node.js via your system package manager (apt, dnf, pacman, brew, etc.) if it isn't already present, then starts the app.

> **Note:** Keep the terminal / command prompt window open while using the app. Closing it stops the server.

---

## Features

### Family Trees
- Create multiple trees with public / family / private visibility
- **Full-width interactive SVG tree** — uses the full screen for maximum visibility
- Zoom, pan, and subtree collapse (click ⊖ to hide a branch)
- **Multi-spouse support** — add two or more partners to any person; they appear side by side in the tree with dashed connector lines and a ♥ symbol
- Add up to 6 members at once with the bulk-add modal
- Full member profiles: name, gender, birth/death year, birth place, biography, photo
- Link paternal parent, maternal parent, spouse, and additional partners for each member
- Paternal / Maternal lineage filter with a "View from" focal person picker
- **Smart search** — finds a member and zooms in to show them together with one generation above and one below
- **Members tab with scroll** — all members are accessible in a scrollable list regardless of tree size
- Download the tree as **PNG** or **PDF**

### Tree Visualization
- **S-curve lineage lines** — smooth cubic bezier curves flow from parent to child, reducing visual clutter from crossing lines
- **Generation color bands** — each generation row has a subtle color-coded background, making it easy to read depth at a glance
- **Generation-colored edges** — lineage lines are colored by the generation cluster they belong to (violet → blue → teal → green → amber → red → pink, cycling)
- Partner connectors are drawn as dashed pink lines with a ♥ heart at the midpoint

### Social
- Activity feed with posts from all your trees
- Post types: birth announcement, milestone, memory, story, update
- Heart reactions and threaded comments
- Notification bell with live updates

### Collaboration
- Invite family members via a shareable link
- Roles: **owner** · **editor** · **viewer**

### Accounts
- Register with display name, username, and email
- Secure JWT login with automatic session refresh
- Profile page with avatar and biography

---

## Project Structure

```
family-tree-project/
├── start.bat          # Windows one-click launcher
├── start.sh           # Linux / Mac one-click launcher
├── server.js          # Express server (entry point)
├── package.json
├── .env.example       # Environment variable reference
├── database/
│   └── db.js          # SQLite setup and schema
├── middleware/
│   ├── auth.js        # JWT verification
│   └── upload.js      # Multer file upload config
├── routes/
│   ├── auth.js        # /api/auth
│   ├── users.js       # /api/users
│   ├── trees.js       # /api/trees
│   ├── members.js     # /api/trees/:id/members
│   ├── social.js      # /api/social (feed, posts, reactions, comments)
│   └── invitations.js # /api/invitations
├── public/            # Web frontend (served automatically)
│   ├── index.html
│   ├── css/app.css
│   └── js/
│       ├── app.js     # SPA controller
│       ├── tree.js    # SVG tree renderer
│       └── api.js     # API client
├── data/              # SQLite database (auto-created on first run)
└── uploads/           # User-uploaded photos and avatars
```

---

## Data Model — Multiple Partners

Each tree member stores partner relationships in two fields:

| Field | Description |
|---|---|
| `spouse_id` | Primary partner (legacy, still supported) |
| `partner_ids` | JSON array of additional partner IDs, e.g. `["uuid1","uuid2"]` |

The tree renderer merges both fields into a unified partner list and positions partners side by side around the focal person. Children whose parents are both in the same partner group are drawn under the group center.

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Windows: "Installation complete — please restart your computer" | Node.js was just installed for the first time; restart once, then double-click `start.bat` again |
| Windows: automatic install failed | Download and install Node.js manually from [nodejs.org](https://nodejs.org), then double-click `start.bat` |
| Linux: permission denied on first run | Run `chmod +x start.sh` once, then `./start.sh` |
| Linux: sudo password prompt during Node.js install | Enter your system password once — this is needed to install Node.js system-wide |
| Page is blank | You opened `index.html` directly — use `http://localhost:3000` instead |
| Port 3000 already in use | `PORT=3001 ./start.sh` (Linux/Mac) or edit `start.bat` and replace `3000` with `3001` |
| Tree looks crowded | Use the zoom controls or pinch-to-zoom; the tree fills the full browser width automatically |
