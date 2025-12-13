#!/usr/bin/env node
/*
  create-admin-user.js
  Usage: node create-admin-user.js <email> [password]
  Environment:
    - Place your downloaded service account JSON at ./serviceAccountKey.json OR set SERVICE_ACCOUNT to its path
    - Optionally set DATABASE_URL to your RTDB URL (defaults to projectId from the service account)

  This script creates a new Firebase Authentication user, marks them in the Realtime
  Database under /admins/<uid> = true and sets a custom claim { admin: true }.
  Do NOT commit your service account JSON to source control.
*/

const admin = require('firebase-admin');
const fs = require('fs');
const path = require('path');

const serviceAccountPath = process.env.SERVICE_ACCOUNT || path.join(__dirname, 'serviceAccountKey.json');
if (!fs.existsSync(serviceAccountPath)) {
  console.error('Service account JSON not found at ' + serviceAccountPath);
  console.error('Download a service account from GCP and set SERVICE_ACCOUNT or place it at ./serviceAccountKey.json');
  process.exit(1);
}

const serviceAccount = require(serviceAccountPath);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  databaseURL: process.env.DATABASE_URL || `https://${serviceAccount.project_id}.firebaseio.com`
});

const email = process.argv[2];
const password = process.argv[3] || 'ChangeMe123!';

if (!email) {
  console.error('Usage: node create-admin-user.js <email> [password]');
  process.exit(1);
}

(async () => {
  try {
    const user = await admin.auth().createUser({ email, password });
    console.log('Created user:', user.uid);

    await admin.database().ref(`/admins/${user.uid}`).set(true);
    console.log(`Set /admins/${user.uid} = true`);

    await admin.auth().setCustomUserClaims(user.uid, { admin: true });
    console.log('Set custom claim { admin: true } for user.');

    console.log('\nDone. You can now sign in with this user in your app.');
    process.exit(0);
  } catch (err) {
    console.error('Error:', err.message || err);
    process.exit(1);
  }
})();
