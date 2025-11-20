/**
 * Firebase Configuration and Initialization
 *
 * IMPORTANT: Firebase API keys are PUBLIC by design in client-side apps.
 * Security comes from Firebase Security Rules, not hiding the key.
 * See firebase-security-rules.txt for setup instructions.
 */

import { initializeApp } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-app.js";
import { getAuth, signInAnonymously, onAuthStateChanged } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-auth.js";
import { getFirestore, collection, query, orderBy, onSnapshot, addDoc, doc, deleteDoc } from "https://www.gstatic.com/firebasejs/11.6.1/firebase-firestore.js";
import { firebaseConfig as defaultConfig } from './firebase-config-values.js';

/**
 * Get Firebase configuration
 *
 * Note: Browser JavaScript cannot access .env files - they're server-side only.
 * For client-side apps, the config must be in the code (this is normal and safe).
 */
function getFirebaseConfig() {
    // Try to get from environment variables (for build-time injection if using a build tool)
    const appId = typeof __app_id !== 'undefined' ? __app_id : 'default-app-id';
    const envConfig = JSON.parse(typeof __firebase_config !== 'undefined' ? __firebase_config : '{}');

    // If environment config exists (from build process), use it
    if (typeof __firebase_config !== 'undefined' && Object.keys(envConfig).length > 0) {
        return envConfig;
    }

    // Otherwise, use the default config from firebase-config-values.js
    return defaultConfig;
}

let app, db, auth;
const activeFirebaseConfig = getFirebaseConfig();

/**
 * Ensure user is authenticated before operations
 */
async function ensureAuthenticated() {
    if (!auth) {
        throw new Error("Auth not initialized");
    }

    // If already authenticated, return immediately
    if (auth.currentUser) {
        return auth.currentUser;
    }

    // Wait for auth state to be ready
    return new Promise((resolve, reject) => {
        const unsubscribe = onAuthStateChanged(auth, (user) => {
            unsubscribe();
            if (user) {
                resolve(user);
            } else {
                // Try to sign in anonymously if not authenticated
                signInAnonymously(auth)
                    .then(() => resolve(auth.currentUser))
                    .catch(reject);
            }
        });
    });
}

/**
 * Initialize Firebase and authenticate anonymously
 */
export async function initializeFirebase() {
    try {
        app = initializeApp(activeFirebaseConfig);
        db = getFirestore(app);
        auth = getAuth(app);

        console.log("Initializing Firebase auth...");
        const userCredential = await signInAnonymously(auth);
        console.log("Anonymous auth successful:", userCredential.user.uid);

        return { app, db, auth, success: true };
    } catch (error) {
        console.error("Fatal Error Initializing Cloud Sync:", error);
        console.error("Error details:", error.code, error.message);
        return { app: null, db: null, auth: null, success: false, error };
    }
}

/**
 * Get the trainings collection reference
 */
export function getTrainingsCollectionRef() {
    if (!db) {
        console.error("Database not initialized.");
        return null;
    }
    const collectionId = activeFirebaseConfig.projectId || 'default-app-id';
    const collectionPath = `artifacts/${collectionId}/public/data/trainings`;
    return collection(db, collectionPath);
}

/**
 * Get the history collection reference
 */
export function getHistoryCollectionRef() {
    if (!db) return null;
    const collectionId = activeFirebaseConfig.projectId || 'default-app-id';
    const collectionPath = `artifacts/${collectionId}/public/data/history`;
    return collection(db, collectionPath);
}

/**
 * Save a custom routine to Firebase
 */
export async function saveCustomRoutine(routine) {
    const ref = getTrainingsCollectionRef();
    if (!ref) return { success: false, error: "Database not initialized" };

    try {
        // Ensure user is authenticated before writing
        const user = await ensureAuthenticated();
        console.log("Save routine: User authenticated:", user ? "Yes" : "No", user?.uid || "N/A");

        const routineData = { ...routine, isCustom: true, createdAt: Date.now() };
        await addDoc(ref, routineData);
        return { success: true };
    } catch (e) {
        console.error("Error adding document: ", e);
        console.error("Auth state:", auth?.currentUser ? "Authenticated" : "Not authenticated");
        return { success: false, error: e };
    }
}

/**
 * Load custom routines from Firebase with real-time updates
 */
export async function loadCustomRoutines(callback) {
    const ref = getTrainingsCollectionRef();
    if (!ref) {
        callback([]);
        return;
    }

    // Ensure authentication is ready before setting up listener
    try {
        await ensureAuthenticated();
    } catch (error) {
        console.error("Auth error in loadCustomRoutines:", error);
        callback([]);
        return;
    }

    const routinesQuery = query(ref, orderBy("createdAt", "desc"));

    // Real-time listener for Routines
    return onSnapshot(routinesQuery, (snapshot) => {
        const customRoutines = snapshot.docs.map(doc => ({
            ...doc.data(),
            id: doc.id,
            isCustom: true
        }));
        callback(customRoutines);
    }, (error) => {
        console.error("Cloud Sync Error:", error);
        callback([]);
    });
}

/**
 * Delete a custom routine from Firebase
 */
export async function deleteCustomRoutine(id) {
    const ref = getTrainingsCollectionRef();
    if (!ref) return { success: false, error: "Database not initialized" };

    try {
        // Ensure user is authenticated before writing
        const user = await ensureAuthenticated();
        console.log("Delete: User authenticated:", user ? "Yes" : "No", user?.uid || "N/A");

        await deleteDoc(doc(ref, id));
        return { success: true };
    } catch (e) {
        console.error("Error deleting document: ", e);
        console.error("Auth state:", auth?.currentUser ? "Authenticated" : "Not authenticated");
        return { success: false, error: e };
    }
}

/**
 * Save training history to Firebase
 */
export async function saveTrainingHistory(routineName, actualDurationSeconds, totalTargetSeconds, completed) {
    const ref = getHistoryCollectionRef();
    if (!ref) return { success: false, error: "Database not initialized" };

    try {
        // Ensure user is authenticated before writing
        const user = await ensureAuthenticated();
        console.log("Save history: User authenticated:", user ? "Yes" : "No", user?.uid || "N/A");

        const historyData = {
            routineName: routineName,
            actualDurationSeconds: Math.floor(actualDurationSeconds),
            totalTargetSeconds: totalTargetSeconds,
            completed: completed,
            timestamp: Date.now(),
        };

        // Check approximate size (rough estimate)
        const dataSize = JSON.stringify(historyData).length;
        console.log("History data size:", dataSize, "bytes (limit: 2048)");

        if (dataSize > 2048) {
            console.warn("History data exceeds 2KB limit!");
        }

        await addDoc(ref, historyData);
        console.log("History saved successfully");
        return { success: true };
    } catch (e) {
        console.error("Error saving history: ", e);
        console.error("Error code:", e.code, "Error message:", e.message);
        console.error("Auth state:", auth?.currentUser ? "Authenticated" : "Not authenticated");
        return { success: false, error: e };
    }
}

/**
 * Load training history from Firebase with real-time updates
 */
export async function loadTrainingHistory(callback) {
    const ref = getHistoryCollectionRef();
    if (!ref) {
        callback([]);
        return;
    }

    // Ensure authentication is ready before setting up listener
    try {
        await ensureAuthenticated();
    } catch (error) {
        console.error("Auth error in loadTrainingHistory:", error);
        callback([]);
        return;
    }

    const historyQuery = query(ref, orderBy("timestamp", "desc"));

    // Real-time listener for History
    return onSnapshot(historyQuery, (snapshot) => {
        const sessions = [];
        snapshot.forEach((doc) => {
            sessions.push({
                id: doc.id,
                ...doc.data()
            });
        });
        callback(sessions);
    }, (error) => {
        console.error("Error loading history:", error);
        callback([]);
    });
}
