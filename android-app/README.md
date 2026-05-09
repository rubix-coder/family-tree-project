# FamilyTree Social — Android App

React Native (Expo) mobile app for the FamilyTree Social platform, targeting Android (Samsung S24+).

## Project Structure

```
family-tree-android/
├── App.js                        # Entry point, auth state bootstrap
├── app.json                      # Expo config (package: com.familytree.social)
├── eas.json                      # EAS Build config (preview = APK)
├── package.json
├── assets/
│   ├── icon.png                  # App icon (1024x1024)
│   ├── adaptive-icon.png         # Android adaptive icon
│   └── splash.png                # Splash screen
└── src/
    ├── navigation/
    │   └── AppNavigator.js       # Stack + Tab navigators
    ├── services/
    │   ├── api.js                # Axios client with auto token refresh
    │   └── storage.js            # AsyncStorage wrapper
    ├── components/
    │   └── TreeVisualization.js  # SVG family tree renderer
    └── screens/
        ├── SetupScreen.js        # Server URL configuration
        ├── AuthScreen.js         # Login / Register
        ├── DashboardScreen.js    # Home feed
        ├── TreesScreen.js        # List & create family trees
        ├── TreeDetailScreen.js   # Tree/Members/Feed tabs
        ├── MemberDetailScreen.js # View & edit member
        ├── AddMemberScreen.js    # Add 1–6 members at once
        ├── ProfileScreen.js      # User profile & settings
        └── NotificationsScreen.js
```

## Prerequisites

- Node.js 18+
- An Expo account (free): https://expo.dev/signup
- The family tree server running (see `/home/user/family-tree-project`)

---

## Option A — EAS Build (Cloud, Recommended)

No Android SDK needed. Expo's cloud service builds the APK for free.

```bash
cd family-tree-android

# 1. Install dependencies (already done if you see node_modules/)
npm install

# 2. Install EAS CLI
npm install -g eas-cli

# 3. Log in to Expo
eas login

# 4. Link project to your Expo account (first time only)
eas init --id <your-expo-project-id>
# OR let it create a new project automatically:
# eas build:configure

# 5. Build APK (uses "preview" profile in eas.json → buildType: "apk")
eas build --platform android --profile preview

# 6. When complete (~10–15 min), download the .apk from the URL shown
#    or from: https://expo.dev → Your project → Builds
```

### Install on Samsung S24+

1. Transfer the `.apk` file to the phone (USB, email, Drive, etc.)
2. On the phone: **Settings → Apps → Special app access → Install unknown apps**
   → allow your file manager or browser
3. Open the APK and tap **Install**

---

## Option B — Local Build with Android Studio

Requires Android Studio with SDK 34.

```bash
cd family-tree-android
npm install

# Generate native android/ directory
npx expo prebuild --platform android

# Build debug APK (no signing needed for local install)
cd android
./gradlew assembleDebug

# APK location:
# android/app/build/outputs/apk/debug/app-debug.apk
```

---

## Running in Development (Expo Go)

For quick testing without building an APK:

```bash
cd family-tree-android
npm install
npx expo start

# Scan the QR code with Expo Go app on your phone
# Phone and computer must be on the same WiFi
```

---

## First Launch Flow

1. **Setup Screen** — Enter server URL (e.g. `http://192.168.1.50:3000`)
2. **Auth Screen** — Login or create an account
3. **Home** — Social feed, quick navigation to Trees / Notifications / Profile

## Features

- SVG family tree visualization with zoom controls
- Add 1–6 members at once with full relationship fields
- Social feed with heart reactions and comments
- Push-to-refresh, loading states, error handling
- JWT auth with automatic token refresh
- Offline-friendly (cached user data)
