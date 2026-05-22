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
        toast.error('記事の読み込みに失敗しました');
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
      const statusLabel = newStatus === 'done' ? '完了' : 'NotebookLM';
      toast.success(`記事を${statusLabel}に移動しました`);
    } catch (error) {
      setArticles(originalArticles);
      console.error('Failed to update status:', error);
      toast.error('ステータスの更新に失敗しました');
    }
  };

  return (
    <div className="space-y-6 pb-10">
      <header>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">Read Later</h2>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-slate-500 text-sm font-medium">保存した記事を読み込み中...</p>
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
                title="完了にする"
              >
                <CheckCircle2 className="h-4 w-4" />
              </button>
              <button 
                className="flex-1 flex items-center justify-center transition-colors hover:bg-purple-50 hover:text-purple-600 text-slate-400"
                onClick={() => handleUpdateStatus(article.id, 'to_notebook')}
                title="NotebookLMキューに追加"
              >
                <Library className="h-4 w-4" />
              </button>
            </ArticleCard>
          ))}
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 text-center border-2 border-dashed rounded-2xl bg-slate-50">
          <p className="text-slate-400 font-bold text-base tracking-tight uppercase">NO ARTICLES SAVED FOR LATER</p>
        </div>
      )}
    </div>
  );
}
