'use client';

import { useState, useEffect } from 'react';
import { Article, ArticleStatus } from '@/types';
import { ArticleCard } from '@/components/article-card';
import { CheckCircle2, Library, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getArticlesByStatus, updateArticleStatus } from '@/lib/db-actions';

export default function ReadLaterPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function fetchData() {
      try {
        const fetched = await getArticlesByStatus('to_read');
        setArticles(fetched);
      } catch (error) {
        console.error('Failed to fetch read-later articles:', error);
        toast.error('Failed to load articles.');
      } finally {
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const handleUpdateStatus = async (id: string, newStatus: ArticleStatus) => {
    const originalArticles = [...articles];
    setArticles(prev => prev.filter(a => a.id !== id));
    
    try {
      await updateArticleStatus(id, newStatus);
      toast.success(`Article moved to ${newStatus}`);
    } catch (error) {
      setArticles(originalArticles);
      console.error('Failed to update status:', error);
      toast.error('Failed to update status.');
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">Read Later</h2>
        <p className="text-slate-500">Weekend reading and deep dives.</p>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-slate-500 font-medium">Loading saved articles...</p>
        </div>
      ) : articles.length > 0 ? (
        <div className="grid grid-cols-1 gap-3">
          {articles.map((article) => (
            <ArticleCard 
              key={article.id} 
              article={article}
              isTriaged={false}
            >
              <button 
                className="flex-1 flex items-center justify-center transition-colors border-b border-slate-200 hover:bg-green-50 hover:text-green-600 text-slate-400"
                onClick={() => handleUpdateStatus(article.id, 'done')}
                title="Mark as Done"
              >
                <CheckCircle2 className="h-5 w-5" />
              </button>
              <button 
                className="flex-1 flex items-center justify-center transition-colors hover:bg-purple-50 hover:text-purple-600 text-slate-400"
                onClick={() => handleUpdateStatus(article.id, 'to_notebook')}
                title="Add to Notebook Queue"
              >
                <Library className="h-5 w-5" />
              </button>
            </ArticleCard>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 text-center border-2 border-dashed rounded-2xl bg-slate-50">
          <p className="text-slate-400 font-medium text-lg">No articles saved for later.</p>
          <p className="text-slate-400 text-sm">Triage some news to fill this list!</p>
        </div>
      )}
    </div>
  );
}
