const admin = require('firebase-admin');
const Parser = require('rss-parser');
const crypto = require('crypto');

// Initialize Admin SDK if not already
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const parser = new Parser();

function articleIdFromUrl(url) {
  return crypto.createHash('md5').update(url).digest('hex');
}

function extractRecentUniqueArticles(feedResults, now = new Date(), hoursAgo = 12) {
  const threshold = new Date(now.getTime() - (hoursAgo * 60 * 60 * 1000));

  const rawArticles = feedResults
    .filter(f => f)
    .flatMap(f => {
      const feedTitle = f.title || '';
      return f.items.map(item => ({
        title: item.title || 'No Title',
        url: item.link || '',
        source: feedTitle,
        contentSnippet: item.contentSnippet || item.content || '',
        publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : now.toISOString(),
      }));
    })
    .filter(a => a.url !== '' && new Date(a.publishedAt) > threshold);

  const uniqueArticlesMap = new Map();
  rawArticles.forEach(a => {
    const id = articleIdFromUrl(a.url);
    if (!uniqueArticlesMap.has(id)) {
      uniqueArticlesMap.set(id, a);
    }
  });

  return { rawArticles, uniqueArticlesMap };
}

function createFetchFeeds({ db, parser, now = () => new Date(), logger = console }) {
  return async (req, res) => {
    try {
      // Fetch feed groups from Firestore
      const groupsSnapshot = await db.collection('feed_groups').get();
      const feedGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

      if (feedGroups.length === 0) {
        logger.log('No feed groups found in Firestore.');
        return res.status(200).send('No feed groups to process.');
      }

      await Promise.all(feedGroups.map(async (group) => {
        logger.log(`Fetching group: ${group.name}`);
        const feedResults = await Promise.all(group.feeds.map(url => parser.parseURL(url).catch(e => {
          logger.error(`Error fetching ${url}:`, e);
          return null;
        })));

        const { rawArticles, uniqueArticlesMap } = extractRecentUniqueArticles(feedResults, now(), 12);

        const uniqueIds = Array.from(uniqueArticlesMap.keys());
        if (uniqueIds.length === 0) {
          logger.log(`No new articles for ${group.name} after local deduplication.`);
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
            source: a.source,
            description: a.description || a.contentSnippet, // fallback to contentSnippet if description is not explicitly set
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

        logger.log(`[${group.name}] Total: ${rawArticles.length}, Unique: ${uniqueIds.length}, New: ${newCount}`);
        return { group: group.name, total: rawArticles.length, unique: uniqueIds.length, new: newCount };
      }));

      // Log total untriaged articles correctly
      const untriagedSnapshot = await db.collection('articles')
        .where('is_triaged', '==', false)
        .count()
        .get();
      
      logger.log(`Fetch completed. Total pending (untriaged) articles: ${untriagedSnapshot.data().count}`);
      res.status(200).send(`Feeds processed. Pending triage: ${untriagedSnapshot.data().count}`);
    } catch (error) {
      logger.error('Fetch Error:', error);
      res.status(500).send(error.message);
    }
  };
}

/**
 * 1. Fetch RSS Feeds and save to Firestore as 'raw'
 */
const fetchFeeds = createFetchFeeds({ db, parser });

module.exports = { fetchFeeds, createFetchFeeds, extractRecentUniqueArticles, articleIdFromUrl };
