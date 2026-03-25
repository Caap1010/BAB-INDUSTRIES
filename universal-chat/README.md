# NEXUS - Firebase Cloud Edition

NEXUS is a static HTML/CSS/JS social app powered by Firebase (free tier friendly).

No local installation is required.

## Features

- Email/password auth + magic link
- Feed (posts, likes, comments, media)
- Stories and reels
- Real-time chat (Firestore listeners)
- Profiles, follows, micro-posts
- PWA support (`manifest.json`, `sw.js`)

## Cloud Setup (Firebase)

1. Create a Firebase project.
2. In Firebase Console, enable:
   - Authentication -> Email/Password
   - Firestore Database
   - Storage
3. Open `js/config.js` and fill `FIREBASE_CONFIG` with your project values.
4. Deploy the `universal-chat` folder to any static host (Vercel static, Netlify, GitHub Pages, etc).

## Firestore Collections

- `profiles`
- `posts`
- `post_media`
- `post_likes`
- `comments`
- `stories`
- `story_views`
- `micro_posts`
- `follows`
- `conversations`
- `messages`

## Storage Paths

- `avatars/{uid}/...`
- `post-media/{uid}/...`
- `story-media/{uid}/...`
- `chat-media/{uid}/...`

## Starter Security Rules

Firestore:

```txt
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

Storage:

```txt
rules_version = '2';
service firebase.storage {
  match /b/{bucket}/o {
    match /{allPaths=**} {
      allow read: if true;
      allow write: if request.auth != null;
    }
  }
}
```

## Notes

- This version is fully cloud based and browser only.
- If config errors appear, verify every key in `FIREBASE_CONFIG`.
- Use a static server (not `file://`) so service worker and auth redirects work properly.
