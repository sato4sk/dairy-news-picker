const admin = require('firebase-admin');
const { GoogleGenAI } = require("@google/genai");
const { format } = require('date-fns');
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
 * Utility for Gemini calls with model fallback
 */
async function callGemini(prompt, schema, modelIndex) {
  let idx = modelIndex;
  while (idx < MODELS.length) {
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
      console.warn(`Gemini Call Failed: Model=${MODELS[idx]}, Duration=${duration}ms`);
      const isRateLimit = error.status === 429 || 
                         (error.response && error.response.status === 429) || 
                         error.message?.includes('429');

      if (isRateLimit) {
        console.warn(`Rate limit (429) hit with ${MODELS[idx]}.`);
        idx++;
      } else {
        throw error;
      }
    }
  }
  throw new Error("All Gemini models exhausted or failed.");
}

/**
 * 2. Triage 'raw' articles using Gemini
 */
const triageArticles = async (req, res) => {
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).send('Unauthorized');
  }

  const triageStartTime = Date.now();
  let currentModelIndex = 0;

  try {
    const snapshot = await db.collection('articles')
      .where('is_triaged', '==', false)
      .limit(500)
      .get();

    if (snapshot.empty) {
      return res.status(200).send('No untriaged articles to process');
    }

    const allRawArticles = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
    
    const groups = {};
    allRawArticles.forEach(a => {
      if (!groups[a.group]) groups[a.group] = [];
      groups[a.group].push(a);
    });

    for (const groupId in groups) {
      const groupConfig = FEED_GROUPS.find(g => g.id === groupId);
      if (!groupConfig) continue;

      const articles = groups[groupId];
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
            category: p.category === 'ignore' ? null : p.category,
            is_triaged: true,
            status: p.category === 'ignore' ? 'done' : 'in_feed',
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

        const today = format(new Date(), 'yyyy-MM-dd');
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
