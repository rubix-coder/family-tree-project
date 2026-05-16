# FamilyTree Social

A full-stack family tree platform with social features — build your family tree, invite relatives to collaborate, and share memories together. Available as a **web app** and an **Android app**.

---

## What's Inside

```
family-tree-project/
├── server.js              # Express API server (entry point)
├── package.json
├── routes/                # REST API route handlers
│   ├── auth.js            # Login, register, token refresh
│   ├── users.js           # User profile management
│   ├── trees.js           # Family tree CRUD + collaborators
│   ├── members.js         # Tree member CRUD + photo upload
│   ├── social.js          # Feed, posts, reactions, comments, notifications
│   └── invitations.js     # Invite link generation and acceptance
├── public/                # Web app (SPA, served by Express)
│   ├── index.html
│   ├── css/app.css
│   └── js/
│       ├── app.js         # SPA controller (auth, routing, all views)
│       ├── tree.js        # SVG family tree visualisation
│       └── api.js         # Fetch-based API client
├── android-app/           # React Native / Expo Android app
├── database/              # SQLite database files
├── uploads/               # User-uploaded photos and avatars
└── family-tree.html       # Legacy offline-only single-file app (kept for reference)
```

---

## Running the Web App

### Prerequisites
- **Node.js 18+** — [nodejs.org](https://nodejs.org)

### Start the server

```bash
cd family-tree-project

# First time only — install dependencies
npm install

# Start the server
npm start
```

You'll see:
```
Server running on http://localhost:3000
```

### Open in browser

```
http://localhost:3000
```

> **Important:** Always open `http://localhost:3000` — do **not** double-click `index.html` directly. Opening it as a `file://` URL skips the server, so all API calls fail and the page stays blank.

---

## Web App Features

### Family Trees
- Create multiple family trees with public / family / private visibility
- Interactive SVG tree visualisation with zoom, pan, and subtree collapse
- Add 1–6 members at once using the bulk add modal
- Full member profiles: name, gender, birth/death year, birth place, biography, photo
- Link paternal parent, maternal parent, and spouse for each member
- Paternal and maternal lineage filter views with a "View from" focal person selector
- Download the tree as **PNG** or **PDF**

### Social
- Activity feed showing posts from trees you're part of
- Post types: birth announcement, milestone, memory, story, update
- Heart reactions and threaded comments on posts
- Real-time notification bell with 30-second polling

### Collaboration
- Invite family members via a shareable token link
- Role-based access: **owner** (full control) · **editor** (add/edit members and posts) · **viewer** (read-only)
- Manage collaborators from the tree settings panel

### Accounts
- Register with display name, username, and email
- JWT authentication — 15-minute access tokens with 7-day refresh tokens
- Profile page with avatar upload and biography

---

## API Overview

All endpoints are prefixed with `/api`.

| Area | Base path |
|---|---|
| Auth | `/api/auth` |
| Users | `/api/users` |
| Trees | `/api/trees` |
| Members | `/api/trees/:treeId/members` |
| Social feed / posts | `/api/social` |
| Notifications | `/api/social/notifications` |
| Invitations | `/api/invitations` |

---

## Android App

See **[android-app/README.md](android-app/README.md)** for the full setup and build guide.

The Android app connects to the same server — point it at your machine's local IP address on first launch.

Quick start with Expo Go (no build needed):

```bash
cd android-app
npm install
npx expo start
# Scan the QR code with the Expo Go app on your phone
# Both devices must be on the same WiFi network
```

---

## Legacy App

`family-tree.html` is a standalone single-file app that runs entirely in the browser with no server — kept for offline or sharing-by-file use cases. It does not connect to the server or sync with the social platform.

---

## Default Ports

| Service | URL |
|---|---|
| Web app + API | `http://localhost:3000` |
| Android app (Expo dev) | `http://localhost:8081` |

---

## Tech Stack

| Layer | Technology |
|---|---|
| Server | Node.js · Express · better-sqlite3 (WAL mode) |
| Auth | JWT (jsonwebtoken) · bcryptjs |
| File uploads | Multer (5 MB limit) |
| Web frontend | Vanilla JS SPA · SVG tree renderer |
| Android | React Native · Expo SDK 51 · react-native-svg |
| Build | EAS Build (cloud APK) or Android Studio |
