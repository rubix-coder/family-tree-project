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
| Windows: "Installation complete — please restart your computer" | Node.js was just installed for the first time; restart once, then double-click `start.bat` again |
| Windows: automatic install failed | Download and install Node.js manually from [nodejs.org](https://nodejs.org), then double-click `start.bat` |
| Linux: permission denied on first run | Run `chmod +x start.sh` once, then `./start.sh` |
| Linux: sudo password prompt during Node.js install | Enter your system password once — this is needed to install Node.js system-wide |
| Page is blank | You opened `index.html` directly — use `http://localhost:3000` instead |
| Port 3000 already in use | `PORT=3001 ./start.sh` (Linux/Mac) or edit `start.bat` and replace `3000` with `3001` |
