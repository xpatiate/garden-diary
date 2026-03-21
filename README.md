# Garden Diary

A personal garden journal PWA built for Android Chrome. Records dated entries combining photos, typed notes, and voice-transcribed notes, all stored per-user in Firebase.

**Live app:** https://catstar-garden-diary.web.app

---

## Contents

- [Tech stack](#tech-stack)
- [Architecture overview](#architecture-overview)
- [Project structure](#project-structure)
- [Data model](#data-model)
- [Local development](#local-development)
- [Running tests](#running-tests)
- [Deployment](#deployment)
- [Backup](#backup)
- [Firebase configuration](#firebase-configuration)
- [Updating security rules](#updating-security-rules)
- [Access control](#access-control)
- [PWA behaviour](#pwa-behaviour)
- [Design system](#design-system)
- [Planned features](#planned-features)

---

## Tech stack

| Layer | Technology | Notes |
|---|---|---|
| Frontend | Vanilla JS (ES modules) + Vite 5 | No framework. All DOM manipulation is imperative. |
| Build | Vite | Bundles JS/CSS, serves dev server with HMR |
| PWA | vite-plugin-pwa (Workbox) | Generates service worker and web app manifest |
| Auth | Firebase Authentication | Google Sign-In via popup |
| Database | Firebase Firestore | NoSQL document store; one collection per user |
| Storage | Firebase Cloud Storage | Photo blobs; paths stored in Firestore |
| Voice | Web Speech API | Browser-native; Android Chrome only |
| EXIF | exifr | Reads EXIF metadata from photo files client-side |
| Dev HTTPS | @vitejs/plugin-basic-ssl | Self-signed cert for local dev (required for camera/mic APIs) |
| Tests | Vitest + happy-dom | Unit tests; happy-dom provides a lightweight DOM environment |

The app has no frontend framework (React, Vue, etc.). Views are functions that write `innerHTML` and attach event listeners. State is local to each view function — there is no global state store.

---

## Architecture overview

### Entry point and shell

`src/main.js` is the application entry point. It:

1. Listens to Firebase auth state changes via `onAuthChange()`.
2. On sign-in, builds a fixed shell: a `#content` div (for views) and a `#nav-wrapper` div (for the bottom navigation bar).
3. Registers three routes and starts the router.
4. Enforces an email allowlist — any authenticated user not in `ALLOWED_EMAILS` is immediately signed out and shown a denial message.

### Router

`src/router.js` is a minimal hash-based router (~40 lines). Routes are registered with `defineRoute(pattern, handler)` where patterns support `:param` segments (e.g. `/entry/:id`). The router listens for `hashchange` events and also runs immediately on startup. Each route handler receives the content element and an object of extracted params. Handlers may return a cleanup function, which is called before the next route renders.

Navigation is done via `navigate(path)`, which sets `window.location.hash`.

### Views

Each view is a single async function that writes HTML into the content container and attaches event listeners. Views are stateless in the sense that they don't persist state between navigations — every visit to a route re-renders from scratch (re-fetching data from Firestore).

- **`login.js`** — Google sign-in button; handles auth errors.
- **`home.js`** — Lists all entries grouped by date. Shows a collapsible month calendar (tap the calendar icon in the header) for browsing by date, with prev/next navigation between entry dates. Tag filter pills and date filter compose together. Entry cards show a thumbnail of the first photo.
- **`new-entry.js`** — Form to create an entry. Saves the Firestore document first, then uploads photos and updates the `photoRefs` field. This two-phase save means a failed photo upload leaves a document with no photos rather than failing silently.
- **`entry.js`** — Shows a single entry. Has two internal render modes: view mode and edit mode, switched by toggling between `renderView()` and `renderEdit()` functions. Editing tracks deleted photos in a `Set` and new photos in an array, applying both atomically on save. Photos open in a full-screen in-app lightbox with prev/next navigation.
- **`import.js`** — Bulk photo import flow. See [Bulk photo import](#bulk-photo-import).

### Components

Components are functions that return a DOM element. They manage their own internal state via closure.

- **`camera.js`** — Two file inputs (one with `capture="environment"` for the camera, one for gallery multi-select). Renders preview thumbnails. Calls `onPhotos(blobs)` with a `File[]` when files are selected.
- **`voice-recorder.js`** — Wraps Web Speech API. Uses `continuous: true` and auto-restarts on `onend` if still recording (the browser ends recognition after silence). Manages two text accumulators: `savedText` (from completed sessions) and `committed` (finals in the current session), combined to avoid double-counting when the recognition session restarts.
- **`tag-input.js`** — Tag chip input. Renders existing tags as removable chips. Adds tags on Enter, comma, or blur. Tags are lowercased, trimmed, and deduplicated. Calls `onChange(tags)` on any change.
- **`nav.js`** — Fixed bottom navigation with Home, Add (+), and Sign-out buttons.

### Services

Service modules abstract Firebase SDK calls and other data logic. They are the only files that import from `firebase/*` or `../firebase.js`. Views and components import from services only.

- **`auth.js`** — `signInWithGoogle()`, `signOutUser()`, `onAuthChange(callback)`.
- **`entries.js`** — Firestore CRUD: `createEntry`, `updateEntry`, `deleteEntry`, `getEntries`, `getEntry`.
- **`photos.js`** — `resizeImage(blob)` (canvas resize to ≤1920px, JPEG 0.85), `uploadPhoto`, `uploadPhotos`, `getPhotoUrl`, `deletePhoto`.
- **`exif.js`** — `getPhotoDate(file)` (EXIF then filename fallback), `groupPhotosByDate(results)`, `localDateStr(date)`. See [Bulk photo import](#bulk-photo-import).

---

## Project structure

```
garden-diary/
├── src/
│   ├── main.js                # Entry point: auth listener, shell, route registration
│   ├── styles.css             # All styles — single file, mobile-first
│   ├── firebase.js            # Firebase SDK init; exports auth, db, storage
│   ├── router.js              # Hash-based router
│   ├── views/
│   │   ├── login.js           # Sign-in screen
│   │   ├── home.js            # Entry list with calendar, date/tag filters, thumbnails
│   │   ├── new-entry.js       # Create entry form
│   │   ├── entry.js           # Entry detail + inline edit + photo lightbox
│   │   └── import.js          # Bulk photo import flow
│   ├── components/
│   │   ├── nav.js             # Bottom navigation bar
│   │   ├── camera.js          # Photo capture/gallery picker
│   │   ├── voice-recorder.js  # Web Speech API wrapper
│   │   └── tag-input.js       # Tag chip input with existing-tag suggestions
│   └── services/
│       ├── auth.js            # Firebase Auth wrappers
│       ├── entries.js         # Firestore CRUD
│       ├── photos.js          # Storage upload/download/delete + canvas resize
│       └── exif.js            # EXIF date reading + filename parsing + date grouping
├── src/tests/
│   ├── router.test.js
│   ├── tag-input.test.js
│   ├── entries.test.js
│   ├── photos.test.js
│   ├── voice-recorder.test.js
│   └── exif.test.js
├── public/
│   └── icons/
│       ├── icon-192.png       # PWA icon (green background, "GD")
│       └── icon-512.png       # PWA icon (maskable)
├── index.html                 # Single HTML file; <div id="app"> is the mount point
├── vite.config.js             # Vite + PWA plugin config
├── vitest.config.js           # Test config (happy-dom environment)
├── package.json
├── Makefile                   # Shortcuts: dev, deploy, backup, backup-full
├── backup.js                  # Firestore/Storage backup script
├── generate-icons.py          # Script to regenerate PWA icons
├── .env.local                 # Firebase config (gitignored — must be created manually)
└── .env.example               # Template showing required variable names
```

---

## Data model

### Firestore

**Collection path:** `users/{userId}/entries/{entryId}`

Each document has this shape:

```
date:             Timestamp    — the garden date the user selected
createdAt:        Timestamp    — server timestamp set on creation
updatedAt:        Timestamp    — server timestamp updated on every write
textNote:         string       — free-text note
voiceTranscript:  string       — text from voice recording (editable)
photoRefs:        string[]     — Storage paths (not URLs); URLs are fetched at render time
tags:             string[]     — lowercase tag strings
```

Firestore timestamps are stored as Firestore `Timestamp` objects, not ISO strings. Code that reads them checks for a `.toDate()` method (Firestore Timestamp) before falling back to `new Date(value)`.

**Security rules** — see [Updating security rules](#updating-security-rules) for how to apply these:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /users/{userId}/entries/{entryId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
    match /users/{userId}/todos/{todoId} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

The database has a custom ID `catstar-garden-diary` (not the Firestore default `(default)`). This is set in `src/firebase.js`:

```js
export const db = getFirestore(app, 'catstar-garden-diary');
```

If this ID is wrong, Firestore calls will silently fail or return empty results. Check this first if data is not loading.

### Cloud Storage

**Path structure:** `users/{userId}/entries/{entryId}/{timestamp}.jpg`

Photos are resized client-side to a maximum of 1920px on the longest side (JPEG, quality 0.85) before uploading. The `photoRefs` field in Firestore stores the Storage path strings — not download URLs. Download URLs are fetched on demand via `getDownloadURL()` each time an entry is rendered.

**Security rules:**

```
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /users/{userId}/entries/{entryId}/{filename} {
      allow read, write: if request.auth != null && request.auth.uid == userId;
    }
  }
}
```

---

## Local development

### Prerequisites

- Node.js 18+
- npm

### Setup

1. Clone the repo and install dependencies:
   ```bash
   npm install
   ```

2. Create `.env.local` in the project root with your Firebase config values (copy from `.env.example` and fill in from the Firebase console → Project settings → Your apps):
   ```
   VITE_FIREBASE_API_KEY=...
   VITE_FIREBASE_AUTH_DOMAIN=...
   VITE_FIREBASE_PROJECT_ID=...
   VITE_FIREBASE_STORAGE_BUCKET=...
   VITE_FIREBASE_MESSAGING_SENDER_ID=...
   VITE_FIREBASE_APP_ID=...
   ```

3. Start the dev server:
   ```bash
   make dev
   # or: npm run dev -- --host 0.0.0.0
   ```

   This runs on `https://0.0.0.0:5173` with a self-signed SSL certificate. The `--host 0.0.0.0` flag exposes it on the local network so you can test on a phone.

### Testing on a phone

The dev server address will be something like `https://192.168.0.52:5173`. Open it on the phone in Chrome. The browser will warn about the self-signed certificate — tap "Advanced" → "Proceed" to continue. This is normal for local dev and safe on a trusted local network.

Camera and microphone APIs require HTTPS, which is why the SSL plugin is used in dev.

### Google Sign-In in development

Google Sign-In via popup works in the dev environment. If you see a domain-not-authorised error, add `localhost` and your local IP to the **Authorised JavaScript origins** list in the Firebase console under Authentication → Settings → Authorised domains.

---

## Running tests

```bash
npm test          # watch mode
npm run test:run  # single run (for CI)
```

Tests use [Vitest](https://vitest.dev/) with [happy-dom](https://github.com/capricorn86/happy-dom) as the DOM environment. Firebase is fully mocked — tests do not make network calls.

**Test coverage:**

| Suite | What is tested |
|---|---|
| `router.test.js` | Route matching, `:param` extraction, multi-param routes, cleanup callbacks, `navigate()` |
| `tag-input.test.js` | Add/remove tags, Enter/comma/blur triggers, lowercase+trim normalisation, dedup, Backspace removal, suggestion chips |
| `entries.test.js` | `createEntry` defaults and field merging, `updateEntry` path and `updatedAt`, `deleteEntry`, `getEntries` response mapping, `getEntry` null/found cases |
| `photos.test.js` | `resizeImage` scale-down, no-upscale, portrait images, null blob and load error handling, URL revocation; `uploadPhoto` return path; `uploadPhotos` progress callback; `getPhotoUrl`; `deletePhoto` |
| `voice-recorder.test.js` | Unsupported browser fallback, recording start/stop, SpeechRecognition configuration, transcript accumulation across sessions, manual edit, permission denied error |
| `exif.test.js` | EXIF tag priority (`DateTimeOriginal` → `CreateDate` → `DateTime`), EXIF error fallback to filename, filename pattern coverage (Android, WhatsApp, Screenshot), invalid year rejection, `groupPhotosByDate` grouping/ordering/unmatched handling |

**Firebase mocking:** `vi.mock('firebase/firestore', ...)` and `vi.mock('../firebase.js', ...)` replace all Firebase SDK calls. Mock functions are declared using `vi.hoisted()` so they are available when the mock factory is evaluated (Vitest hoists `vi.mock` calls to the top of the file before imports run).

**Canvas mocking in photo tests:** `document.createElement('canvas')` is intercepted with `vi.spyOn`, and `Image` is replaced with a class that immediately calls `onload` with configurable dimensions.

---

## Deployment

The app is hosted on Firebase Hosting, and can be managed in the (Firebase console)[https://console.firebase.google.com].

```bash
make deploy
# Runs: npm run build && firebase deploy --only hosting
```

Firebase CLI is installed at `~/.npm-global/bin/firebase`. If it is not on your PATH, the Makefile calls it by full path.

The build output goes to `dist/`. Vite bundles all JS/CSS and the PWA plugin generates the service worker and manifest. The service worker is registered automatically by `vite-plugin-pwa` with `registerType: 'autoUpdate'`, meaning users get updates silently on the next visit.

The Firebase Hosting configuration is in `.firebaserc` and `firebase.json` (not checked in — these are generated by `firebase init hosting`).

---

## Backup

```bash
make backup        # Exports all Firestore documents to backups/YYYY-MM-DD/data.json
make backup-full   # Same, plus downloads all photos from Cloud Storage
```

The backup script is `backup.js`. It uses the `firebase-admin` SDK with application default credentials. Ensure you have a service account key configured before running.

---

## Firebase configuration

The Firebase project details:

| Setting | Value |
|---|---|
| Project ID | `catstar-garden-diary` |
| Auth domain | `catstar-garden-diary.firebaseapp.com` |
| Storage bucket | `catstar-garden-diary.firebasestorage.app` |
| Firestore database ID | `catstar-garden-diary` (custom, not `(default)`) |
| Region | Europe |
| Plan | Blaze (pay-as-you-go) |

Firebase config values (API key, app ID, etc.) are stored in `.env.local` as `VITE_*` variables. Vite exposes these to client-side code as `import.meta.env.VITE_*`. They are gitignored. If you need to recreate `.env.local`, the values are in the Firebase console under Project settings → Your apps → SDK setup and configuration.

---

## Updating security rules

Firebase security rules are edited in the Firebase console — they are not deployed from this repo.

**Firestore rules:** [console.firebase.google.com](https://console.firebase.google.com) → select the project → **Firestore Database** → **Rules** tab

**Storage rules:** same console → **Storage** → **Rules** tab

Paste in the updated rules and click **Publish**. Changes take effect within a minute or so.

The current rules to apply are shown in the [Data model](#data-model) section above (Firestore) and below (Storage).

---

## Access control

The app uses Firebase Authentication for identity, but access to the app itself is restricted to a hardcoded allowlist in `src/main.js`:

```js
const ALLOWED_EMAILS = ['catstarpipewall@gmail.com'];
```

Any user who successfully authenticates with Google but whose email is not in this list is immediately signed out and shown a "Access denied" message. Firestore security rules provide a second layer — users can only read and write their own documents.

To grant access to additional users, add their Google account email to `ALLOWED_EMAILS` in `src/main.js`.

---

## PWA behaviour

The app is a Progressive Web App. On Android Chrome, the user will be prompted to install it to the home screen, after which it runs in standalone mode (no browser chrome).

**Caching strategy** (configured in `vite.config.js` via Workbox):

| Resource | Strategy | Notes |
|---|---|---|
| App shell (JS, CSS, HTML, icons) | Cache-first (precached) | Updated on new deploy |
| Firestore API requests | Network-first | Falls back to cache if offline |
| Firebase Storage photos | Cache-first | Cached for 30 days, max 200 entries |

The network-first strategy for Firestore means the home screen will show cached data when offline but will always attempt to fetch fresh data when a connection is available.

**Icons** are at `public/icons/icon-192.png` and `public/icons/icon-512.png`. To regenerate them, run `python3 generate-icons.py` (requires Pillow: `pip install Pillow`).

---

## Design system

All styles are in `src/styles.css`. CSS custom properties defined on `:root`:

```css
--green-dark:   #2d5a3d   /* header, primary buttons */
--green:        #4a7c59   /* accents, nav active state */
--green-light:  #e8f0ea   /* subtle backgrounds */
--cream:        #f5f0eb   /* page background */
--text:         #2c2c2c
--text-muted:   #6b7280
--error:        #dc2626
--nav-height:   64px
--header-height: 56px
```

The layout is a flex column. The `#content` div has `padding-bottom: var(--nav-height)` so content is not obscured by the fixed bottom nav.

---

## Bulk photo import

Accessible via "Import multiple photos by date →" in the new entry form, or directly at `#/import`.

### Flow

1. **Pick** — multi-select photos from the gallery (no camera capture).
2. **Preview** — the app reads EXIF metadata and filename patterns for each file client-side (no upload yet), then groups them by calendar date and displays a preview with scrollable thumbnail strips for each group.
3. **Import** — one Firestore entry is created per date group, photos are uploaded sequentially, and a live progress list shows the status of each entry.

### Date detection

`src/services/exif.js` uses the [exifr](https://github.com/MikeKovarik/exifr) library to read EXIF tags in priority order: `DateTimeOriginal` → `CreateDate` → `DateTime`. If EXIF is absent or unreadable (e.g. WhatsApp photos, screenshots), it falls back to parsing the filename with a regex that handles the common Android and messaging app patterns:

| Pattern | Example |
|---|---|
| `YYYYMMDD_HHMMSS` | `IMG_20250315_142305.jpg` |
| `YYYY-MM-DD HH.MM.SS` | `2025-03-15 14.23.05.jpg` |
| `YYYY-MM-DD_HH-MM-SS` | `2025-03-15_14-23-05.jpg` |
| `Screenshot_YYYYMMDD-HHMMSS` | `Screenshot_20250315-142305.jpg` |
| `WhatsApp Image YYYY-MM-DD` | `WhatsApp Image 2025-03-15 at 14.jpg` |

### Undated photos

If no date can be determined from EXIF or filename, the photos appear in a separate "date not found" section with a date picker. Import is blocked until all photos have a date assigned.

### Design decisions

- **Always creates new entries** — never merges into an existing entry for that date, even if one exists.
- **Groups by calendar date** — photos from the same day are placed in one entry regardless of time of day.
- **No thumbnail storage** — there is no separate thumbnail image. The home screen shows the first photo of each entry scaled down by CSS, loaded lazily and cached by the service worker.
