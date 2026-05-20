const admin = require('firebase-admin');
const { GoogleGenAI } = require("@google/genai");
const { format, addHours } = require('date-fns');
const { FEED_GROUPS } = require('./config');

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

    for (const groupConfig of FEED_GROUPS) {
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

      const CHUNK_SIZE = 100;
      const coreAndRelated = [];
      const stats = { core: 0, related: 0, random: 0, ignore: 0 };

      for (let i = 0; i < articles.length; i += CHUNK_SIZE) {
        const chunk = articles.slice(i, i + CHUNK_SIZE);
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
            status: p.category === 'ignore' ? 'done' : 'in_feed',
            triaged_at: triagedAt,
          };
          
          batch.update(db.collection('articles').doc(orig.id), updateData);

          if (p.category === 'core' || p.category === 'related') {
            coreAndRelated.push(orig);
          }
        });
        await batch.commit();
      }

      console.log(`[${groupConfig.name}] Stats: core=${stats.core}, related=${stats.related}, random=${stats.random}, ignore=${stats.ignore}`);

      if (coreAndRelated.length > 0) {
        const summaryPrompt = `
          Generate a daily summary (朝の要約) in Japanese for the group "${groupConfig.name}".
          Highlight key trends and important news from the following articles.
          
          Rules:
          - Do NOT include any title like "【IT-News 本日の朝刊要約】".
          - Summarize into 3-5 key points.
          - Start each point on a NEW line.
          - Do NOT add blank lines between points.
          - Each point should start with a number (e.g., "1. ") or a bullet.
          - Keep it concise and plain text.
          
          Articles:
          ${coreAndRelated.map(a => `- ${a.title}`).join("\n")}
        `;

        const { result: summaryResult, nextIndex: sIdx } = await callGemini(summaryPrompt, summarySchema, currentModelIndex);
        currentModelIndex = sIdx;

        const summaryId = `${today}_${groupId}`;
        await db.collection('daily_summaries').doc(summaryId).set({
          id: summaryId,
          group: groupId,
          content: summaryResult.dailySummary,
        });
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
