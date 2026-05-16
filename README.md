# FamilyTree Social

A family tree platform with social features — build your tree, invite relatives to collaborate, and share memories together.

---

## Quick Start

### Windows — double-click `start.bat`

That's it. The script installs dependencies on first run, starts the server, and opens the app in your browser automatically.

### Linux / Mac — run `start.sh`

```bash
./start.sh
```

If you see a "permission denied" error, run this once first:
```bash
chmod +x start.sh
```

Then open **`http://localhost:3000`** in your browser (it usually opens automatically).

> **Note:** Keep the terminal / command prompt window open while using the app. Closing it stops the server.

---

## Requirements

- **Node.js 18 or higher** — download from [nodejs.org](https://nodejs.org) (choose the LTS version)

Verify it's installed:
```
node --version
```

You should see `v18.x.x` or higher. On Windows, restart your terminal after installing Node.js.

---

## Features

### Family Trees
- Create multiple trees with public / family / private visibility
- Interactive SVG tree with zoom, pan, and subtree collapse (click ⊖ to hide a branch)
- Add up to 6 members at once with the bulk-add modal
- Full member profiles: name, gender, birth/death year, birth place, biography, photo
- Link paternal parent, maternal parent, and spouse for each member
- Paternal / Maternal lineage filter with a "View from" focal person picker
- Download the tree as **PNG** or **PDF**

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

## Troubleshooting

| Problem | Fix |
|---|---|
| `node` is not recognised | Install Node.js from [nodejs.org](https://nodejs.org), then restart your terminal |
| Page is blank | You opened `index.html` directly — use `http://localhost:3000` instead |
| `Cannot find module 'express'` | Run `npm install` in the project folder, or use the start script which does this automatically |
| Port 3000 already in use | Set a different port: `PORT=3001 ./start.sh` (Linux) or edit `start.bat` and change `3000` to `3001` |
| `permission denied` on start.sh | Run `chmod +x start.sh` once, then try again |
