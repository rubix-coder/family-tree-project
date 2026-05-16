# FamilyTree Social

A family tree platform with social features — build your tree, invite relatives to collaborate, and share memories together.

---

## Quick Start

### Windows — double-click `start.bat`

The script checks for Node.js, installs it guides you if it's missing, installs app dependencies on first run, starts the server, and opens `http://localhost:3000` in your browser — all automatically.

### Linux / Mac — run `start.sh`

```bash
./start.sh
```

If you see a "permission denied" error, run this once first:
```bash
chmod +x start.sh
./start.sh
```

The script will detect if Node.js is missing and print the exact install command for your distro (Ubuntu, Fedora, Arch, macOS), then exit so you can install it and run again.

> **Note:** Keep the terminal / command prompt window open while using the app. Closing it stops the server.

---

## Node.js — the only requirement

The app needs **Node.js 18+** to run. The start scripts detect whether it is installed and guide you through the process if it isn't.

**If you prefer to install it manually before running the script:**

| Platform | Method |
|---|---|
| Windows | Download the LTS installer from [nodejs.org](https://nodejs.org), run it, then restart your PC |
| Ubuntu / Debian | `curl -fsSL https://deb.nodesource.com/setup_20.x \| sudo -E bash - && sudo apt-get install -y nodejs` |
| Fedora / RHEL | `curl -fsSL https://rpm.nodesource.com/setup_20.x \| sudo bash - && sudo dnf install -y nodejs` |
| Arch Linux | `sudo pacman -S nodejs npm` |
| macOS | `brew install node` or download from [nodejs.org](https://nodejs.org) |

Verify it is installed correctly:
```
node --version
```
You should see `v18.x.x` or higher.

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
| `start.bat` says Node.js not installed | Follow the on-screen link to [nodejs.org](https://nodejs.org), install, restart your PC, then double-click again |
| `start.sh` says Node.js not installed | Copy the install command shown on screen for your distro, run it, then run `./start.sh` again |
| Node.js version too old | Download the latest LTS from [nodejs.org](https://nodejs.org) and reinstall |
| Page is blank | You opened `index.html` directly — use `http://localhost:3000` instead |
| Port 3000 already in use | `PORT=3001 ./start.sh` (Linux/Mac) or edit `start.bat` and replace `3000` with `3001` |
| `permission denied` on start.sh | Run `chmod +x start.sh` once, then `./start.sh` |
