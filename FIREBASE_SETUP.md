# Firebase Security Rules Setup - FIX PERMISSION ERRORS

## Quick Fix Steps:

1. **Go to Firebase Console:**
   - https://console.firebase.google.com/
   - Select project: **zentrainersync**

2. **Open Firestore Database:**
   - Click "Firestore Database" in the left sidebar
   - Click the "Rules" tab at the top

3. **Replace ALL the existing rules with this:**

```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    // Allow read/write access to trainings collection
    match /artifacts/{projectId}/public/data/trainings/{routineId} {
      allow read, write: if true;
    }

    // Allow read/write access to history collection
    match /artifacts/{projectId}/public/data/history/{historyId} {
      allow read, write: if true;
    }

    // Deny all other access
    match /{document=**} {
      allow read, write: if false;
    }
  }
}
```

4. **Click "Publish"** (button at the top)

5. **Wait 10-30 seconds** for rules to propagate

6. **Refresh your app** and try again!

## What These Rules Do:

- ✅ Allow anyone to read/write to `artifacts/{projectId}/public/data/trainings`
- ✅ Allow anyone to read/write to `artifacts/{projectId}/public/data/history`
- ✅ Block access to everything else

## If You Still Get Errors:

1. Check the browser console for the exact error message
2. Verify the rules were published (you should see a timestamp)
3. Make sure you're using anonymous authentication (the app does this automatically)

## Current Default Rules (WRONG):

If you see rules like this, they need to be replaced:
```javascript
rules_version = '2';
service cloud.firestore {
  match /databases/{database}/documents {
    match /{document=**} {
      allow read, write: if false;  // ❌ This blocks everything!
    }
  }
}
```
