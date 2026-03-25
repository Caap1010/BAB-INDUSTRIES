/* ============================================================
   NEXUS — Firebase Auth Utilities
   ============================================================ */

const Auth = (() => {

    function ensureClient() {
        if (!fbAuth || !fbDb) {
            throw new Error(window.NEXUS_CONFIG_ERROR || 'Firebase is not configured.');
        }
    }

    async function init() {
        ensureClient();

        if (fbAuth.isSignInWithEmailLink(window.location.href)) {
            let email = window.localStorage.getItem('nexus_email_for_signin');
            if (!email) email = window.prompt('Confirm your email to finish sign-in');
            if (email) {
                await fbAuth.signInWithEmailLink(email, window.location.href);
                window.localStorage.removeItem('nexus_email_for_signin');
                window.history.replaceState({}, document.title, window.location.pathname + window.location.search);
            }
        }

        await new Promise(resolve => {
            const unsubscribe = fbAuth.onAuthStateChanged(async user => {
                CURRENT_USER = user || null;
                CURRENT_PROFILE = user ? await fetchProfile(user.uid) : null;
                unsubscribe();
                resolve();
            });
        });

        fbAuth.onAuthStateChanged(async user => {
            CURRENT_USER = user || null;
            CURRENT_PROFILE = user ? await fetchProfile(user.uid) : null;
        });

        return CURRENT_USER;
    }

    async function fetchProfile(userId) {
        ensureClient();
        const snap = await fbDb.collection('profiles').doc(userId).get();
        if (!snap.exists) return null;
        return snap.data();
    }

    async function usernameExists(username) {
        const snap = await fbDb.collection('profiles').where('username', '==', username).limit(1).get();
        return !snap.empty;
    }

    async function signUp(email, password, username) {
        ensureClient();

        if (await usernameExists(username)) {
            throw new Error('Username already taken.');
        }

        const cred = await fbAuth.createUserWithEmailAndPassword(email, password);
        const user = cred.user;

        await fbDb.collection('profiles').doc(user.uid).set({
            id: user.uid,
            username,
            display_name: username,
            avatar_url: '',
            bio: '',
            website: '',
            created_at: firebase.firestore.FieldValue.serverTimestamp(),
            updated_at: firebase.firestore.FieldValue.serverTimestamp(),
        }, { merge: true });

        CURRENT_USER = user;
        CURRENT_PROFILE = await fetchProfile(user.uid);
        return { data: { user, session: true } };
    }

    async function signIn(email, password) {
        ensureClient();
        const cred = await fbAuth.signInWithEmailAndPassword(email, password);
        CURRENT_USER = cred.user;
        CURRENT_PROFILE = await fetchProfile(cred.user.uid);
        return { data: { user: cred.user } };
    }

    async function signInWithMagicLink(email) {
        ensureClient();
        const settings = { url: `${location.origin}/login.html`, handleCodeInApp: true };
        await fbAuth.sendSignInLinkToEmail(email, settings);
        window.localStorage.setItem('nexus_email_for_signin', email);
    }

    async function signOut() {
        ensureClient();
        await fbAuth.signOut();
        CURRENT_USER = null;
        CURRENT_PROFILE = null;
        location.href = 'index.html';
    }

    function requireAuth() {
        if (!CURRENT_USER) {
            location.href = `login.html?next=${encodeURIComponent(location.pathname + location.search)}`;
            return false;
        }
        return true;
    }

    return { init, signUp, signIn, signInWithMagicLink, signOut, requireAuth, fetchProfile };
})();
