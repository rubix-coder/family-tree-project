# FamilyTree Social — Android App

React Native (Expo SDK 51) mobile app for the FamilyTree Social platform. Connects to the same Express server as the web app and targets Android 7.0+ (optimised for Samsung S24+).

---

## Project Structure

```
android-app/
├── App.js                          # Entry point — auth state bootstrap, nav ref
├── app.json                        # Expo config (package: com.familytree.social)
├── eas.json                        # EAS Build profiles (preview → APK)
├── babel.config.js
├── package.json
├── assets/
│   ├── icon.png                    # App icon (1024×1024)
│   ├── adaptive-icon.png           # Android adaptive icon
│   ├── splash.png                  # Splash screen
│   └── favicon.png
└── src/
    ├── navigation/
    │   └── AppNavigator.js         # Stack navigator + bottom tab navigator
    ├── services/
    │   ├── api.js                  # Axios client with auto token refresh interceptor
    │   └── storage.js              # AsyncStorage wrapper (tokens, user, server URL)
    ├── components/
    │   └── TreeVisualization.js    # SVG family tree renderer (react-native-svg)
    └── screens/
        ├── SetupScreen.js          # First-launch server URL configuration
        ├── AuthScreen.js           # Login / Register (tabbed)
        ├── DashboardScreen.js      # Home social feed with reactions
        ├── TreesScreen.js          # List and create family trees
        ├── TreeDetailScreen.js     # Tree view / Members list / Feed tabs
        ├── MemberDetailScreen.js   # View, edit, and delete a member
        ├── AddMemberScreen.js      # Add 1–6 members at once
        ├── NotificationsScreen.js  # Notification list with mark-all-read
        └── ProfileScreen.js        # User profile, edit bio, sign out
```

---

## Prerequisites

- **Node.js 18+**
- **An Expo account (free)** — [expo.dev/signup](https://expo.dev/signup)
- **The FamilyTree server running** — see the root `README.md`; start it with `npm start` in the project root

---

## Option A — EAS Build (Cloud, Recommended)

No Android SDK or Android Studio required. Expo's cloud service compiles the APK for you on their servers (free tier available, ~10–15 min build time).

```bash
cd android-app

# 1. Install dependencies
npm install

# 2. Install EAS CLI globally
npm install -g eas-cli

# 3. Log in to your Expo account
eas login

# 4. First time only — link to your Expo project
eas build:configure

# 5. Build the APK
eas build --platform android --profile preview
```

When the build completes, the CLI prints a download URL. You can also find all builds at [expo.dev](https://expo.dev) → Your Project → Builds.

### Install the APK on Samsung S24+

1. Transfer the `.apk` to the phone (USB cable, Google Drive, email, etc.)
2. On the phone: **Settings → Apps → Special app access → Install unknown apps**
   → enable your file manager or browser
3. Open the `.apk` file and tap **Install**

---

## Option B — Local Build with Android Studio

Requires Android Studio (SDK 34, Build Tools 34).

```bash
cd android-app

# 1. Install dependencies
npm install

# 2. Generate the native android/ directory
npx expo prebuild --platform android

# 3. Build a debug APK
cd android
./gradlew assembleDebug
```

APK output path:
```
android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Option C — Expo Go (Development / Testing)

Fastest way to test — no build step needed. Requires the **Expo Go** app installed on your phone ([Play Store](https://play.google.com/store/apps/details?id=host.exp.exponent)).

```bash
cd android-app
npm install
npx expo start
```

Scan the QR code shown in the terminal with the Expo Go app. **Both your phone and computer must be on the same WiFi network.**

---

## First Launch Flow

| Screen | What happens |
|---|---|
| **Setup** | Enter your server URL (e.g. `http://192.168.1.50:3000`). The app validates connectivity before saving. |
| **Auth** | Login with existing account or register a new one. |
| **Home** | Social feed — posts and reactions from your family trees. |
| **Trees** | List all your trees; tap to open or create a new one. |
| **Tree Detail** | Three tabs: SVG tree view · Members list · Tree feed. |
| **Add Member** | Add up to 6 members at once with full relationship fields. |
| **Notifications** | All activity across your trees; tap to navigate to the source. |
| **Profile** | Edit display name and bio; sign out. |

### Finding your server IP (for Setup screen)

Run this on the computer where the server is running:
```bash
hostname -I     # Linux / Mac
ipconfig        # Windows — look for IPv4 Address
```

Enter that IP as: `http://192.168.x.x:3000`

---

## Features

- SVG family tree visualisation with zoom in/out/reset and nested scroll pan
- Add 1–6 members at once with name, gender, birth/death year, birth place, biography, and relationship pickers
- View and edit any member inline — father, mother, spouse pickers with scrollable lists
- Social feed with heart reactions (toggle on/off)
- Pull-to-refresh on all list screens
- JWT authentication with automatic silent token refresh via Axios interceptor
- Session expiry redirects to Auth automatically
- AsyncStorage persistence — server URL, tokens, and user profile cached locally

---

## Tech Stack

| | |
|---|---|
| Framework | React Native via Expo SDK 51 |
| Navigation | React Navigation v6 (Stack + Bottom Tabs) |
| SVG | react-native-svg 15.2 |
| HTTP | Axios with request/response interceptors |
| Storage | @react-native-async-storage/async-storage |
| Build | EAS Build (`eas.json` preview profile → `buildType: "apk"`) |
| Min SDK | Android 7.0 (API 24) |
| Target SDK | Android 14 (API 34) |
