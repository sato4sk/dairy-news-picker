const admin = require('firebase-admin');
const Parser = require('rss-parser');
const crypto = require('crypto');
const { FEED_GROUPS } = require('./config');

// Initialize Admin SDK if not already
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const parser = new Parser();

/**
 * 1. Fetch RSS Feeds and save to Firestore as 'raw'
 */
const fetchFeeds = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).send('Unauthorized');
  }

  try {
    const results = await Promise.all(FEED_GROUPS.map(async (group) => {
      console.log(`Fetching group: ${group.name}`);
      const feedResults = await Promise.all(group.feeds.map(url => parser.parseURL(url).catch(e => {
        console.error(`Error fetching ${url}:`, e);
        return null;
      })));

      const now = new Date();
      const hoursAgo = 12;
      const threshold = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));

      const rawArticles = feedResults
        .filter(f => f)
        .flatMap(f => f.items.map(item => ({
          title: item.title || 'No Title',
          url: item.link || '',
          contentSnippet: item.contentSnippet || item.content || '',
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        })))
        .filter(a => a.url !== '' && new Date(a.publishedAt) > threshold);

      // Deduplicate locally by URL hash
      const uniqueArticlesMap = new Map();
      rawArticles.forEach(a => {
        const id = crypto.createHash('md5').update(a.url).digest('hex');
        if (!uniqueArticlesMap.has(id)) {
          uniqueArticlesMap.set(id, a);
        }
      });

      const uniqueIds = Array.from(uniqueArticlesMap.keys());
      if (uniqueIds.length === 0) {
        console.log(`No new articles for ${group.name} after local deduplication.`);
        return { group: group.name, total: rawArticles.length, unique: 0, new: 0 };
      }

      // 1. Efficient existence check using db.getAll()
      const existingIds = new Set();
      const docRefs = uniqueIds.map(id => db.collection('articles').doc(id));
      const snapshots = await db.getAll(...docRefs);
      snapshots.forEach(snap => {
        if (snap.exists) existingIds.add(snap.id);
      });

      // 2. Separate into New and Existing to handle flags correctly
      const batch = db.batch();
      let newCount = 0;

      uniqueArticlesMap.forEach((a, id) => {
        const ref = db.collection('articles').doc(id);
        const isNew = !existingIds.has(id);
        
        const baseData = {
          id: id,
          title: a.title,
          url: a.url,
          description: a.contentSnippet,
          group: group.id,
          published_at: a.publishedAt,
        };

        if (isNew) {
          // New article: Initialize with is_triaged: false
          batch.set(ref, { ...baseData, is_triaged: false });
          newCount++;
        } else {
          // Existing article: Update info but NEVER touch is_triaged or status
          batch.set(ref, baseData, { merge: true });
        }
      });

      await batch.commit();

      console.log(`[${group.name}] Total: ${rawArticles.length}, Unique: ${uniqueIds.length}, New: ${newCount}`);
      return { group: group.name, total: rawArticles.length, unique: uniqueIds.length, new: newCount };
    }));

    // Log total untriaged articles correctly
    const untriagedSnapshot = await db.collection('articles')
      .where('is_triaged', '==', false)
      .count()
      .get();
    
    console.log(`Fetch completed. Total pending (untriaged) articles: ${untriagedSnapshot.data().count}`);
    res.status(200).send(`Feeds processed. Pending triage: ${untriagedSnapshot.data().count}`);
  } catch (error) {
    console.error('Fetch Error:', error);
    res.status(500).send(error.message);
  }
};

module.exports = { fetchFeeds };
