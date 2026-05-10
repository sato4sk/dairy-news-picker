'use client';

import { useState, useEffect } from 'react';
import { Article, ArticleStatus } from '@/types';
import { Card, CardFooter, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { CheckCircle2, ExternalLink, Library, Loader2 } from 'lucide-react';
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
        <div className="grid gap-6">
          {articles.map((article) => (
            <Card key={article.id} className="overflow-hidden">
              <div className="md:flex">
                <div className="flex-1 p-6">
                  <div className="flex items-start justify-between gap-4">
                    <div>
                      <CardTitle className="mb-2 text-xl font-bold leading-tight">
                        {article.title}
                      </CardTitle>
                      <p className="text-slate-600 leading-relaxed line-clamp-3">
                        {article.description}
                      </p>
                    </div>
                  </div>
                </div>
                <CardFooter className="flex flex-row gap-2 border-t bg-slate-50/50 p-4 md:w-72 md:flex-col md:border-l md:border-t-0">
                  <Button 
                    className="flex-1 gap-2 md:w-full h-12 rounded-xl"
                    onClick={() => window.open(article.url, '_blank')}
                  >
                    <ExternalLink className="h-4 w-4" />
                    Open Article
                  </Button>
                  <div className="flex flex-1 gap-2 md:w-full">
                    <Button 
                      variant="outline"
                      className="flex-1 gap-2 h-12 rounded-xl border-green-100 hover:bg-green-50 hover:text-green-600"
                      onClick={() => handleUpdateStatus(article.id, 'done')}
                    >
                      <CheckCircle2 className="h-4 w-4" />
                      Done
                    </Button>
                    <Button 
                      variant="outline"
                      className="flex-1 gap-2 h-12 rounded-xl border-purple-100 hover:bg-purple-50 hover:text-purple-600"
                      onClick={() => handleUpdateStatus(article.id, 'to_notebook')}
                    >
                      <Library className="h-4 w-4" />
                      Pool
                    </Button>
                  </div>
                </CardFooter>
              </div>
            </Card>
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
