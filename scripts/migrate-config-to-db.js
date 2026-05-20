const admin = require('firebase-admin');
const { FEED_GROUPS } = require('../functions/config');

if (!admin.apps.length) {
  admin.initializeApp();
}

const db = admin.firestore();

async function migrate() {
  console.log('Starting migration of feed groups to Firestore...');
  
  for (const group of FEED_GROUPS) {
    console.log(`Migrating group: ${group.name} (${group.id})...`);
    await db.collection('feed_groups').doc(group.id).set({
      name: group.name,
      keywords: group.keywords,
      feeds: group.feeds,
      updated_at: admin.firestore.FieldValue.serverTimestamp(),
    }, { merge: true });
  }

  console.log('Migration completed successfully.');
}

migrate().catch(err => {
  console.error('Migration failed:', err);
  process.exit(1);
});
