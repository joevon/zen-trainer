/**
 * Firebase Configuration Values
 *
 * IMPORTANT SECURITY NOTE:
 *
 * Firebase API keys are PUBLIC by design - they're meant to be in client-side code.
 * Security is NOT provided by hiding the API key. Instead, Firebase uses:
 *
 * 1. Firebase Security Rules - Control who can read/write data
 * 2. Authentication - Control who is authenticated
 * 3. API Key Restrictions - Limit which domains can use the key (optional)
 *
 * The API key alone cannot:
 * - Access your data without proper authentication
 * - Bypass Security Rules
 * - Perform admin operations
 *
 * To secure your Firebase project:
 * 1. Go to Firebase Console → Firestore Database → Rules
 * 2. Set up proper Security Rules (see firebase-security-rules.txt)
 * 3. (Optional) Go to Firebase Console → Project Settings → API Keys
 *    → Restrict the API key to specific HTTP referrers (your domain)
 */

export const firebaseConfig = {
    apiKey: "AIzaSyDjtgHP3gx_AV7PX4oJ3l4ZaSKP0vXuNYI",
    authDomain: "zentrainersync.firebaseapp.com",
    projectId: "zentrainersync",
    storageBucket: "zentrainersync.firebasestorage.app",
    messagingSenderId: "180521552924",
    appId: "1:180521552924:web:0d3437027f12ebb7c5a3d9"
};
