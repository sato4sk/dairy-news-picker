const functions = require('@google-cloud/functions-framework');
const admin = require('firebase-admin');
const { GoogleGenerativeAI, SchemaType } = require("@google/generative-ai");
const Parser = require('rss-parser');
const { format } = require('date-fns');
const crypto = require('crypto');

/**
 * Configuration:
 * In a production environment, consider moving this to a Firestore collection
 * or a secret manager if it becomes large.
 */
const FEED_GROUPS = [
  {
    id: 'general',
    name: 'General',
    keywords: ['札幌', 'イベント', 'ニュース', '経済', 'ビジネス'],
    feeds: [
      'https://news.google.com/news/rss/search?q=%E6%9C%AD%E5%B9%8C%E3%80%80%E3%82%A4%E3%83%99%E3%83%B3%E3%83%88&hl=ja-JP&gl=JP&ceid=JP:ja',
      'https://www3.nhk.or.jp/rss/news/cat0.xml',
      'https://toyokeizai.net/list/feed/rss',
    ],
  },
  {
    id: 'it_news',
    name: 'IT-News',
    keywords: ['NotebookLM', 'AI', 'プログラミング', 'ガジェット', '開発', 'クラウド'],
    feeds: [
      'https://www.google.co.jp/alerts/feeds/09952907680721164926/14984348748901127565',
      'https://news.google.com/news/rss/search?q=NotebookLM&hl=en',
      'https://connpass.com/explore/ja.atom',
      'https://www.gizmodo.jp/index.xml',
      'https://www.publickey1.jp/atom.xml',
      'https://techcrunch.com/feed/',
      'https://www.atmarkit.co.jp/rss/rss091.xml',
      'https://rss.itmedia.co.jp/rss/1.0/topstory.xml',
    ],
  },
  {
    id: 'it_blog',
    name: 'IT-Blog',
    keywords: ['AWS', '設計', 'フロントエンド', 'テックブログ', 'エンジニアリング'],
    feeds: [
      'https://aws.amazon.com/jp/blogs/aws/feed/',
      'https://techblog.lycorp.co.jp/ja/feed/index.xml',
      'https://zenn.dev/feed',
      'https://qiita.com/popular-items/feed',
      'https://dev.classmethod.jp/feed/',
      'https://engineering.mercari.com/blog/feed.xml',
    ],
  },
  {
    id: 'aws_info',
    name: 'AWS-info',
    keywords: ['AWS', 'Cloud', 'Infrastructure', 'Security', 'Serverless'],
    feeds: [
      'https://aws.amazon.com/blogs/aws/feed',
      'https://aws.amazon.com/jp/blogs/news/feed',
      'https://www.youtube.com/feeds/videos.xml?user=AmazonWebServicesJP',
      'https://d3gih7jbfe3jlq.cloudfront.net/aws-podcast.rss',
      'https://alas.aws.amazon.com/alas.rss',
    ],
  },
  {
    id: 'salesforce_info',
    name: 'Salesforce-info',
    keywords: ['Salesforce', 'CRM', 'SaaS', 'Apex', 'Cloud'],
    feeds: [
      'https://feeds.feedburner.com/SforceBlog',
      'https://www.salesforce.com/jp/blog/feed/',
      'https://www.salesforce.com/jp/news/feed/',
    ],
  },
];

// Initialize Admin SDK
if (!admin.apps.length) {
  admin.initializeApp();
}
const db = admin.firestore();
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);
const parser = new Parser();

const articleSchema = {
  type: SchemaType.OBJECT,
  properties: {
    articles: {
      type: SchemaType.ARRAY,
      items: {
        type: SchemaType.OBJECT,
        properties: {
          originalIndex: { type: SchemaType.NUMBER },
          category: { type: SchemaType.STRING, enum: ["core", "related", "random", "ignore"] }
        },
        required: ["originalIndex", "category"]
      }
    },
    dailySummary: {
      type: SchemaType.STRING
    }
  },
  required: ["articles", "dailySummary"]
};

async function processWithGemini(groupName, keywords, articles, maxRandom) {
  const model = genAI.getGenerativeModel({
    model: "gemini-2.5-flash",
    generationConfig: { responseMimeType: "application/json", responseSchema: articleSchema },
  });

  const prompt = `
    You are an AI assistant helping a user triage their daily news based on specific interests.
    Target Group: ${groupName}
    Interest Keywords: ${keywords.join(", ")}

    Tasks:
    1. Classify each article into core/related/random/ignore.
       - "core": High priority. Directly matches interests.
       - "related": Medium priority. Indirectly related.
       - "random": Low priority serendipity. High quality but non-keyword matches.
       - "ignore": Discard noise.
    2. Generate a "daily summary" (朝の要約) in Japanese highlighting trends from "core" and "related" items.

    Constraints:
    - Be strict. Use "ignore" for anything not clearly relevant.
    - "random" items MUST NOT exceed ${maxRandom} articles in this batch.

    Input:
    ${articles.map((a, i) => `[${i}] ${a.title}\n${a.contentSnippet}`).join("\n\n")}
  `;

  const result = await model.generateContent(prompt);
  return JSON.parse(result.response.text());
}

functions.http('processFeeds', async (req, res) => {
  // Simple auth if needed, though Cloud Scheduler can handle this via OIDC
  const authHeader = req.headers.authorization;
  if (process.env.CRON_SECRET && authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return res.status(401).send('Unauthorized');
  }

  try {
    for (const group of FEED_GROUPS) {
      console.log(`Processing group: ${group.name}`);
      const feedResults = await Promise.all(group.feeds.map(url => parser.parseURL(url).catch(e => {
        console.error(`Error fetching ${url}:`, e);
        return null;
      })));

      const rawArticles = feedResults
        .filter(f => f)
        .flatMap(f => f.items.map(item => ({
          title: item.title || 'No Title',
          url: item.link || '',
          contentSnippet: item.contentSnippet || item.content || '',
          publishedAt: item.pubDate ? new Date(item.pubDate).toISOString() : new Date().toISOString(),
        })))
        .filter(a => a.url !== '');

      if (rawArticles.length === 0) continue;

      const batchToProcess = rawArticles
        .sort((a, b) => new Date(b.publishedAt) - new Date(a.publishedAt))
        .slice(0, 20);

      const maxRandom = Math.max(1, Math.floor(batchToProcess.length * 0.1));
      const geminiResult = await processWithGemini(group.name, group.keywords, batchToProcess, maxRandom);

      const today = format(new Date(), 'yyyy-MM-dd');
      const batch = db.batch();

      // Summary
      const summaryId = `${today}_${group.id}`;
      batch.set(db.collection('daily_summaries').doc(summaryId), {
        id: summaryId,
        group: group.id,
        content: geminiResult.dailySummary,
      });

      // Articles
      geminiResult.articles.forEach(p => {
        const orig = batchToProcess[p.originalIndex];
        if (!orig || p.category === 'ignore') return;
        const id = crypto.createHash('md5').update(orig.url).digest('hex');
        batch.set(db.collection('articles').doc(id), {
          id,
          title: orig.title,
          url: orig.url,
          description: orig.contentSnippet,
          group: group.id,
          category: p.category,
          status: 'in_feed',
          published_at: orig.publishedAt,
          queued_at: null,
        }, { merge: true });
      });

      await batch.commit();
      console.log(`Success: ${group.name}`);
    }
    res.status(200).send('All feeds processed');
  } catch (error) {
    console.error('Fatal Error:', error);
    res.status(500).send(error.message);
  }
});
