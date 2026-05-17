export type ArticleCategory = 'core' | 'related' | 'random' | 'ignore';
export type ArticleStatus = 'raw' | 'in_feed' | 'to_read' | 'to_notebook' | 'done';

export interface Article {
  id: string;
  title: string;
  url: string;
  source?: string; // RSS feed title
  description: string; // Original RSS snippet
  group: string;
  category: ArticleCategory;
  status: ArticleStatus;
  published_at: string; // ISO string
  triaged_at: string | null; // ISO string
  queued_at: string | null; // ISO string
}

export interface DailySummary {
  id: string; // Date string 'YYYY-MM-DD'
  group: string;
  content: string;
}

export interface FeedGroup {
  id: string;
  name: string;
  keywords: string[];
  feeds: string[];
}
