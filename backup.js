#!/usr/bin/env node
/**
 * Garden Diary backup script
 *
 * Usage:
 *   node backup.js              # Firestore documents only
 *   node backup.js --photos     # Firestore documents + Storage photos
 *
 * Output:
 *   backups/YYYY-MM-DD/data.json
 *   backups/YYYY-MM-DD/photos/<userId>/<entryId>/<filename>  (with --photos)
 */

import admin from 'firebase-admin';
import { createRequire } from 'module';
import fs from 'fs';
import path from 'path';
import https from 'https';

const require = createRequire(import.meta.url);
const serviceAccount = require('./atstar-garden-diary-firebase-adminsdk-fbsvc-93c57f0f81.json');

const includePhotos = process.argv.includes('--photos');
const date = new Date().toISOString().slice(0, 10);
const outDir = path.join('backups', date);

admin.initializeApp({
  credential: admin.credential.cert(serviceAccount),
  storageBucket: 'catstar-garden-diary.firebasestorage.app',
});

const db = admin.firestore();
db.settings({ databaseId: 'catstar-garden-diary' });
const bucket = admin.storage().bucket();

// ── Helpers ────────────────────────────────────────────────────

function download(url, destPath) {
  return new Promise((resolve, reject) => {
    fs.mkdirSync(path.dirname(destPath), { recursive: true });
    const file = fs.createWriteStream(destPath);
    https.get(url, res => {
      if (res.statusCode === 301 || res.statusCode === 302) {
        file.close();
        download(res.headers.location, destPath).then(resolve).catch(reject);
        return;
      }
      res.pipe(file);
      file.on('finish', () => file.close(resolve));
    }).on('error', err => {
      fs.unlink(destPath, () => {});
      reject(err);
    });
  });
}

// ── Main ───────────────────────────────────────────────────────

async function backup() {
  fs.mkdirSync(outDir, { recursive: true });

  console.log('Backing up Firestore…');
  const usersSnap = await db.collection('users').get();
  const allData = {};

  for (const userDoc of usersSnap.docs) {
    const userId = userDoc.id;
    const entriesSnap = await db.collection('users').doc(userId).collection('entries').get();
    allData[userId] = entriesSnap.docs.map(d => ({ id: d.id, ...d.data() }));
    console.log(`  ${userId}: ${entriesSnap.size} entries`);
  }

  const jsonPath = path.join(outDir, 'data.json');
  fs.writeFileSync(jsonPath, JSON.stringify(allData, null, 2));
  console.log(`Saved ${jsonPath}`);

  if (!includePhotos) return;

  console.log('\nBacking up photos…');
  const [files] = await bucket.getFiles({ prefix: 'users/' });
  console.log(`  Found ${files.length} files`);

  for (const file of files) {
    const destPath = path.join(outDir, 'photos', file.name);
    const [url] = await file.getSignedUrl({ action: 'read', expires: Date.now() + 60_000 });
    await download(url, destPath);
    process.stdout.write('.');
  }

  if (files.length) console.log();
  console.log(`Photos saved to ${path.join(outDir, 'photos')}`);
}

backup()
  .then(() => console.log('\nBackup complete.'))
  .catch(err => { console.error('Backup failed:', err); process.exit(1); });
