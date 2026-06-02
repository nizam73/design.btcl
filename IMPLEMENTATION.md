# IMPLEMENTATION GUIDE — design.btcl v2

## File Structure

```
your-project/
├── index.html
├── style.css
├── app.js
├── firebase-init.js
├── env-loader.js
├── .env                  ← your secret keys (never commit this)
├── logo BTCL only.jpg    ← preview images go here (root folder)
├── govt logo.png
└── ...other images
```

---

## Step 1 — Create a Firebase Project

1. Go to **https://console.firebase.google.com**
2. Click **Add project** → name it (e.g. `design-btcl`) → Continue
3. Disable Google Analytics if you don't need it → Create project

---

## Step 2 — Enable Google Authentication

1. Inside your Firebase project → left sidebar → **Build → Authentication**
2. Click **Get started**
3. Under **Sign-in method** tab → click **Google** → toggle **Enable** → Save
4. Set your **Project support email** (use your Gmail)

---

## Step 3 — Create Firestore Database

1. Left sidebar → **Build → Firestore Database**
2. Click **Create database**
3. Choose **Start in production mode** → Next
4. Pick a region (e.g. `asia-south1` for Bangladesh) → Enable

### Set Firestore Security Rules

In the **Rules** tab, paste this and click **Publish**:

```
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {

    // Config (admin list) — only admins can write
    match /config/{doc} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/config/admins).data.emails
          .hasAny([request.auth.token.email]);
    }

    // Tabs — anyone can read; only admins can write
    match /tabs/{tabId} {
      allow read: if true;
      allow write: if request.auth != null &&
        get(/databases/$(database)/documents/config/admins).data.emails
          .hasAny([request.auth.token.email]);

      // Cards inside tabs
      match /cards/{cardId} {
        allow read: if true;
        allow write: if request.auth != null &&
          get(/databases/$(database)/documents/config/admins).data.emails
            .hasAny([request.auth.token.email]);
      }
    }
  }
}
```

---

## Step 4 — Get Your Firebase Config Keys

1. Firebase Console → ⚙ (gear icon, top-left) → **Project settings**
2. Scroll to **Your apps** → click **</>** (Web) → Register app (name: `design-btcl-web`)
3. Copy the config object shown — it looks like:

```js
const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "design-btcl.firebaseapp.com",
  projectId: "design-btcl",
  storageBucket: "design-btcl.appspot.com",
  messagingSenderId: "123456789",
  appId: "1:123...:web:abc..."
};
```

4. Open your `.env` file and fill in the values:

```
FIREBASE_API_KEY=AIza...
FIREBASE_AUTH_DOMAIN=design-btcl.firebaseapp.com
FIREBASE_PROJECT_ID=design-btcl
FIREBASE_STORAGE_BUCKET=design-btcl.appspot.com
FIREBASE_MESSAGING_SENDER_ID=123456789
FIREBASE_APP_ID=1:123...:web:abc...
```

---

## Step 5 — Add env-loader to index.html

Open `index.html` and add this **before** the two `<script type="module">` lines at the bottom:

```html
<!-- Load .env config FIRST, before Firebase modules -->
<script src="env-loader.js"></script>
```

So the bottom of your `<body>` should look like:

```html
  <script src="env-loader.js"></script>
  <script type="module" src="firebase-init.js"></script>
  <script type="module" src="app.js"></script>
</body>
```

---

## Step 6 — Add Authorized Domain in Firebase

1. Firebase Console → **Authentication** → **Settings** tab
2. Under **Authorized domains** → Add your domain:
   - For **Netlify**: `your-site-name.netlify.app`
   - For **localhost testing**: `localhost` is already there by default

---

## Step 7 — Seed Initial Data in Firestore (first-time only)

You need to create at least one tab manually in Firestore so the app has something to show.

1. Firebase Console → Firestore Database → **+ Start collection**
2. Collection ID: `tabs`
3. Auto-generate document ID → Add fields:
   - `name` (string): `Home`
   - `order` (number): `0`
   - `createdAt` (timestamp): now
4. Click **Save**

After that, you can create all tabs and cards from the admin portal inside the app.

**Alternatively**, sign in as admin in the app first, then use the **＋ Tab** button — no manual seeding needed.

---

## Step 8 — Deploy to Netlify

1. Go to **https://netlify.com** → Log in
2. Drag and drop your entire project folder onto the Netlify dashboard
3. Your site is live!

> ⚠️ **Important**: The `.env` file will be publicly accessible on Netlify because it's a static site. Firebase API keys for web apps are safe to expose (they're restricted by domain + Firestore rules), but if you want extra protection, add your Netlify domain to the Firebase **API key restrictions** in Google Cloud Console.

---

## How the App Works

### For regular users
- Can browse all tabs and see card content (headlines, preview images)
- Clicking a **download button** (Vector / Image / PDF) requires Google sign-in
- A login popup appears, then the file link opens automatically after sign-in

### For admins
- Sign in with Google using an admin email
- A **pencil icon** (✎) appears next to each tab name for renaming
- A **＋ Tab** button appears in the tab bar for adding new tabs
- A **＋ Add Card** button appears above each tab's cards
- Each card has a **⋮** menu with Edit and Delete options
- **Admin Portal** (⋮ top-right menu) lets you add/remove admin emails

### Share Links
- Every card has a **share icon** (top-right)
- Clicking it copies a direct URL to that specific card
- Opening that URL highlights the card with a green pulse animation

---

## Adding Preview Images

- Place all image files directly in the **root folder** (same level as `index.html`)
- When adding/editing a card, enter the exact filename in the **Preview image filename** field
- Example: `logo BTCL only.jpg` or `GPON-Poster-2025-prev.png`
- Broken images are silently hidden (won't break layout)

---

## Firestore Data Structure

```
/tabs/{tabId}
  - name: string
  - order: number
  - createdAt: timestamp

  /cards/{cardId}
    - headline: string
    - desc: string
    - warning: string
    - imageName: string
    - imageAlt: string
    - btnGreen: string (URL)
    - btnDark: string (URL)
    - btnLight: string (URL)
    - order: number
    - createdAt: timestamp
    - updatedAt: timestamp

/config/admins
  - emails: string[]
```

---

## Troubleshooting

| Problem | Fix |
|---|---|
| Blank page / console error about ENV | Make sure `env-loader.js` script tag is ABOVE the module scripts |
| "Firebase: No app" error | Check that `.env` values are filled in correctly (no quotes, no spaces) |
| Google sign-in popup blocked | Allow popups for your domain in browser settings |
| "Permission denied" in Firestore | Check that your email is in the admins list and rules are published |
| Images not showing | Confirm file is in root folder and filename matches exactly (case-sensitive) |
| Deep link doesn't focus card | Wait for cards to load; the focus fires after a 400ms delay |
