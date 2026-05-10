import { FeedGroup } from '@/types';

export const FEED_GROUPS: FeedGroup[] = [
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
