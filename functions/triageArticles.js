const admin = require('firebase-admin');
const { GoogleGenAI } = require("@google/genai");
const { format, addHours } = require('date-fns');

// Initialize Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

const MODELS = [
  "gemini-3-flash-preview",
  "gemini-2.5-flash",
  "gemini-3.1-flash-lite-preview",
  "gemini-2.5-flash-lite"
];

const MAX_RETRIES = 3;
const INITIAL_BACKOFF_MS = 1000;

const sleep = (ms) => new Promise(resolve => setTimeout(resolve, ms));

/**
 * URL Normalization to help deduplication
 */
function normalizeUrl(url) {
  try {
    const u = new URL(url);
    // Remove common tracking parameters
    const trackingParams = ['utm_source', 'utm_medium', 'utm_campaign', 'utm_term', 'utm_content', 'ref', 'rss'];
    trackingParams.forEach(p => u.searchParams.delete(p));
    
    // Normalize host and path
    return u.origin.toLowerCase() + u.pathname.replace(/\/$/, "").toLowerCase() + (u.search ? u.search : "");
  } catch (e) {
    return url.toLowerCase().replace(/\/$/, "");
  }
}

/**
 * Title Normalization to help deduplication
 */
function normalizeTitle(title) {
  return title.toLowerCase().trim().replace(/[ \t\n\r]/g, "");
}

/**
 * Deduplicate articles within a group
 */
async function deduplicateArticles(articles, db) {
  const urlMap = new Map();
  const titleMap = new Map();
  const duplicates = [];
  const uniqueArticles = [];

  for (const article of articles) {
    const normUrl = normalizeUrl(article.url);
    const normTitle = normalizeTitle(article.title);
    
    let duplicateOf = null;
    if (urlMap.has(normUrl)) {
      duplicateOf = urlMap.get(normUrl);
    } else if (titleMap.has(normTitle)) {
      duplicateOf = titleMap.get(normTitle);
    }

    if (duplicateOf) {
      duplicates.push({ article, originalId: duplicateOf.id });
    } else {
      urlMap.set(normUrl, article);
      titleMap.set(normTitle, article);
      uniqueArticles.push(article);
    }
  }

  if (duplicates.length > 0) {
    console.log(`Found ${duplicates.length} duplicate articles.`);
    const batch = db.batch();
    duplicates.forEach(({ article, originalId }) => {
      batch.update(db.collection('articles').doc(article.id), {
        status: 'done',
        is_triaged: true,
        category: 'duplicated', 
        duplicate_of: originalId,
        triaged_at: new Date().toISOString()
      });
    });
    await batch.commit();
  }

  return uniqueArticles;
}

const BUILD_SUMMARY_PROMPT = (groupName, articles, suffix = '') => `
    Generate a daily summary (朝の要約) in Japanese for the group "${groupName}"${suffix}.
    Highlight key trends and important news from the following articles.
    
    Rules:
    - Do NOT include any title like "【IT-News 本日の朝刊要約】".
    - Summarize into 3-5 key points.
    - Start each point on a NEW line.
    - Do NOT add blank lines between points.
    - Each point should start with a number (e.g., "1. ") or a bullet.
    - Keep it concise and plain text.
    
    Articles:
    ${articles.map(a => `- ${a.title}`).join("\n")}
  `;

/**
 * Executes a Gemini call using a single fixed model (gemini-2.5-flash).
 * Used for non-critical tasks like summarizing ignored articles where
 * fallback logic is not required.
 */
async function callGeminiSingleModel(articles, groupName, ai, isIgnore = false) {
  if (articles.length === 0) return null;

  const prompt = BUILD_SUMMARY_PROMPT(groupName, articles, isIgnore ? ' (Low priority items)' : '');

  try {
    const response = await ai.models.generateContent({
      model: "gemini-2.5-flash",
      contents: prompt,
    });
    
    return response.text;
  } catch (error) {
    console.warn(`Failed to generate single-model summary for ${groupName} (isIgnore=${isIgnore}): ${error.message}`);
    return null;
  }
}

const classificationSchema = {
  type: "object",
  properties: {
    articles: {
      type: "array",
      items: {
        type: "object",
        properties: {
          originalIndex: { type: "number" },
          category: { type: "string", enum: ["core", "related", "random", "ignore"] }
        },
        required: ["originalIndex", "category"]
      }
    }
  },
  required: ["articles"]
};

const summarySchema = {
  type: "object",
  properties: {
    dailySummary: { type: "string" }
  },
  required: ["dailySummary"]
};

/**
 * Utility for Gemini calls with model fallback and retry logic
 */
async function callGemini(prompt, schema, modelIndex) {
  let idx = modelIndex;
  while (idx < MODELS.length) {
    let retryCount = 0;
    while (retryCount <= MAX_RETRIES) {
      const startTime = Date.now();
      try {
        const response = await ai.models.generateContent({
          model: MODELS[idx],
          contents: prompt,
          config: {
            responseMimeType: "application/json",
            responseSchema: schema,
          }
        });
        const duration = Date.now() - startTime;
        console.log(`Gemini Call Success: Model=${MODELS[idx]}, Duration=${duration}ms`);
        return { result: JSON.parse(response.text), nextIndex: idx };
      } catch (error) {
        const duration = Date.now() - startTime;
        const status = error.status || error.response?.status;
        const isRateLimit = status === 429 || 
                           (error.response && error.response.status === 429) || 
                           error.message?.includes('429');
        const isServerError = (status >= 500 && status < 600) || 
                             error.message?.includes('500') || 
                             error.message?.includes('503');

        console.warn(`Gemini Call Failed: Model=${MODELS[idx]}, Status=${status}, Duration=${duration}ms, Error=${error.message}`);

        if (isRateLimit) {
          console.warn(`Rate limit (429) hit with ${MODELS[idx]}. Switching to next model immediately.`);
          idx++;
          break; // Exit retry loop to switch model
        } else if (isServerError) {
          if (retryCount < MAX_RETRIES) {
            const backoff = INITIAL_BACKOFF_MS * Math.pow(2, retryCount);
            console.warn(`Server error (${status}) with ${MODELS[idx]}. Retrying in ${backoff}ms... (Attempt ${retryCount + 1}/${MAX_RETRIES})`);
            await sleep(backoff);
            retryCount++;
            continue; // Retry with same model
          } else {
            console.warn(`Max retries reached for ${MODELS[idx]} on server error. Switching to next model.`);
            idx++;
            break; // Exit retry loop to switch model
          }
        } else {
          // For other errors (e.g., 400), log and throw to avoid infinite loops or wrong assumptions
          console.error(`Fatal Gemini Error: ${error.message}`);
          throw error;
        }
      }
    }
  }
  throw new Error("All Gemini models exhausted or failed.");
}

/**
 * 2. Triage 'raw' articles using Gemini
 */
const triageArticles = async (req, res) => {
  const triageStartTime = Date.now();
  let currentModelIndex = 0;

  try {
    const now = new Date();
    // Use true UTC for timestamp
    const triagedAt = now.toISOString();
    
    // Use JST for logical daily grouping (e.g. 6:00 AM JST is today's triage)
    const jstNow = addHours(now, 9);
    const today = format(jstNow, 'yyyy-MM-dd');

    console.log(`Starting triage at UTC: ${triagedAt} (JST: ${today})`);

    // Fetch feed groups from Firestore
    const groupsSnapshot = await db.collection('feed_groups').get();
    const feedGroups = groupsSnapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));

    if (feedGroups.length === 0) {
      console.log('No feed groups found in Firestore.');
      return res.status(200).send('No feed groups to triage.');
    }

    for (const groupConfig of feedGroups) {
      const groupId = groupConfig.id;
      const snapshot = await db.collection('articles')
        .where('group', '==', groupId)
        .where('is_triaged', '==', false)
        .limit(300)
        .get();

      if (snapshot.empty) {
        console.log(`No untriaged articles for group: ${groupConfig.name}`);
        continue;
      }

      const articles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
      console.log(`Triaging ${articles.length} articles for group: ${groupConfig.name}`);

      // Deduplicate before processing
      const uniqueArticles = await deduplicateArticles(articles, db);
      console.log(`Group: ${groupConfig.name}, Unique Articles: ${uniqueArticles.length}/${articles.length}`);

      const CHUNK_SIZE = 100;
      const coreAndRelated = [];
      const ignoredToSummarize = [];
      const stats = { core: 0, related: 0, random: 0, ignore: 0 };

      for (let i = 0; i < uniqueArticles.length; i += CHUNK_SIZE) {
        const chunk = uniqueArticles.slice(i, i + CHUNK_SIZE);
        const maxRandom = Math.max(1, Math.floor(chunk.length * 0.1));

        const prompt = `
          Task: Classify these news articles for the group "${groupConfig.name}".
          Interests: ${groupConfig.keywords.join(", ")}
          
          Categories:
          - "core": Directly matches interests.
          - "related": Indirectly related.
          - "random": High quality but non-keyword matches (limit to ${maxRandom}).
          - "ignore": Not relevant.

          Input:
          ${chunk.map((a, idx) => `[${idx}] ${a.title}\n${a.description}`).join("\n\n")}
        `;

        const { result, nextIndex } = await callGemini(prompt, classificationSchema, currentModelIndex);
        currentModelIndex = nextIndex;

        const batch = db.batch();
        result.articles.forEach(p => {
          const orig = chunk[p.originalIndex];
          if (!orig) return;

          stats[p.category]++;
          const updateData = {
            category: p.category,
            is_triaged: true,
            status: 'in_feed',
            triaged_at: triagedAt,
          };
          
          batch.update(db.collection('articles').doc(orig.id), updateData);

          if (p.category === 'core' || p.category === 'related') {
            coreAndRelated.push(orig);
          } else if (p.category === 'ignore') {
            ignoredToSummarize.push(orig);
          }
        });
        await batch.commit();
      }

      console.log(`[${groupConfig.name}] Stats: core=${stats.core}, related=${stats.related}, random=${stats.random}, ignore=${stats.ignore}`);

      // Generate summaries
      const ignoreSummary = await callGeminiSingleModel(ignoredToSummarize, groupConfig.name, ai, true);

      if (coreAndRelated.length > 0 || ignoreSummary) {
        let coreSummary = null;
        if (coreAndRelated.length > 0) {
          const prompt = BUILD_SUMMARY_PROMPT(groupConfig.name, coreAndRelated);

          const { result: summaryResult, nextIndex: sIdx } = await callGemini(prompt, summarySchema, currentModelIndex);
          currentModelIndex = sIdx;
          coreSummary = summaryResult.dailySummary;
        }

        const summaryId = `${today}_${groupId}`;
        await db.collection('daily_summaries').doc(summaryId).set({
          id: summaryId,
          group: groupId,
          content: coreSummary || "No primary news summary available.",
          ignore_content: ignoreSummary,
        }, { merge: true });
      }
    }

    res.status(200).send('Triage completed');
    const totalDuration = Date.now() - triageStartTime;
    console.log(`Triage Task Finished. Total Duration: ${totalDuration}ms`);
  } catch (error) {
    console.error('Triage Error:', error);
    res.status(500).send(error.message);
  }
};

module.exports = { triageArticles };
