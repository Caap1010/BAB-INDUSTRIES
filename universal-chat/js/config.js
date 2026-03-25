/* ============================================================
   NEXUS — Firebase Configuration (Cloud Only)
   ============================================================ */

const FIREBASE_CONFIG = {
    apiKey: 'YOUR_FIREBASE_API_KEY',
    authDomain: 'YOUR_PROJECT_ID.firebaseapp.com',
    projectId: 'YOUR_PROJECT_ID',
    storageBucket: 'YOUR_PROJECT_ID.appspot.com',
    messagingSenderId: 'YOUR_SENDER_ID',
    appId: 'YOUR_APP_ID',
};

const APP_NAME = 'NEXUS';
const APP_VERSION = '2.0.0-firebase';

const BUCKETS = {
    AVATARS: 'avatars',
    POSTS: 'post-media',
    STORIES: 'story-media',
    MESSAGES: 'chat-media',
};

const MAX_FILE_SIZE = 50 * 1024 * 1024;

window.NEXUS_CONFIG_ERROR = '';

const hasRealConfig =
    FIREBASE_CONFIG.apiKey && !FIREBASE_CONFIG.apiKey.includes('YOUR_FIREBASE_API_KEY') &&
    FIREBASE_CONFIG.projectId && !FIREBASE_CONFIG.projectId.includes('YOUR_PROJECT_ID');

let fbApp = null;
let fbAuth = null;
let fbDb = null;
let fbStorage = null;

if (!window.firebase) {
    window.NEXUS_CONFIG_ERROR = 'Firebase SDK failed to load. Check internet/CDN access.';
} else if (!hasRealConfig) {
    window.NEXUS_CONFIG_ERROR = 'Set Firebase values in js/config.js.';
} else {
    fbApp = firebase.initializeApp(FIREBASE_CONFIG);
    fbAuth = firebase.auth();
    fbDb = firebase.firestore();
    fbStorage = firebase.storage();
}

window.fbAuth = fbAuth;
window.fbDb = fbDb;
window.fbStorage = fbStorage;

let CURRENT_USER = null;
let CURRENT_PROFILE = null;
