'use client';

import { useState, useEffect, useCallback } from 'react';
import { Article, ArticleStatus } from '@/types';
import { Card, CardContent } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, CheckCircle2, Loader2, BookOpen } from 'lucide-react';
import { toast } from 'sonner';
import { getNotebookQueue, batchUpdateStatus, updateArticleStatus } from '@/lib/db-actions';

export default function NotebookQueuePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fetched = await getNotebookQueue(10);
      setArticles(fetched);
    } catch (error) {
      console.error('Failed to fetch queue:', error);
      toast.error('キューの読み込みに失敗しました');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    async function load() {
      await fetchData();
    }
    load();
  }, [fetchData]);

  const urlsText = articles.map(a => a.url).join('\n');

  const handleCopy = async () => {
    if (urlsText) {
      const textArea = document.createElement("textarea");
      textArea.value = urlsText;
      
      textArea.style.position = "fixed";
      textArea.style.left = "-9999px";
      textArea.style.top = "0";
      textArea.style.opacity = "0";
      document.body.appendChild(textArea);
      textArea.focus();
      textArea.select();
      
      let successful = false;
      try {
        successful = document.execCommand('copy');
      } catch (err) {
        console.error('execCommand copy failed:', err);
      }
      
      document.body.removeChild(textArea);

      if (!successful) {
        try {
          await navigator.clipboard.writeText(urlsText);
          successful = true;
        } catch (err) {
          console.error('Final fallback copy failed:', err);
        }
      }

      if (successful) {
        setCopied(true);
        toast.success('URLをクリップボードにコピーしました');
        setTimeout(() => setCopied(false), 2000);
      } else {
        toast.error('コピーに失敗しました');
      }
    }
  };

  const handleDoneAndNext = async () => {
    const ids = articles.map(a => a.id);
    if (ids.length === 0) return;

    try {
      await batchUpdateStatus(ids, 'done');
      toast.success(`${ids.length}件の記事を完了にしました`);
      fetchData(); // Load next batch
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('更新に失敗しました');
    }
  };

  const handleUpdateStatus = async (id: string, newStatus: ArticleStatus) => {
    try {
      await updateArticleStatus(id, newStatus);
      setArticles((prev) => prev.filter((a) => a.id !== id));
      const statusLabel = newStatus === 'to_read' ? '「後で読む」' : '「完了」';
      toast.success(`記事を${statusLabel}に移動しました`);
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('ステータスの更新に失敗しました');
    }
  };

  return (
    <div className="space-y-4 pb-10">
      <header>
        <h2 className="text-2xl font-bold tracking-tight text-slate-900">NotebookLM キュー</h2>
        <p className="text-slate-500 text-sm font-medium">URLをNotebookLMにコピーして完了にします。</p>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-slate-500 text-sm font-medium">読み込み中...</p>
        </div>
      ) : articles.length > 0 ? (
        <div className="space-y-4">
          <Card className="overflow-hidden border border-blue-100 shadow-sm bg-white py-0 gap-0">
            <div className="flex items-center justify-between px-4 py-2.5">
              <span className="text-xs font-bold text-blue-900 uppercase tracking-tighter">
                URLを一括コピー
              </span>
              <div className="flex items-center gap-2">
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCopy}
                  className="h-7 px-2.5 gap-1.5 bg-white text-[10px] font-bold border-blue-200 hover:bg-blue-50"
                >
                  {copied ? <Check className="h-3 w-3" /> : <Copy className="h-3 w-3" />}
                  {copied ? 'コピー済み' : 'コピー'}
                </Button>
                <Button 
                  size="sm" 
                  className="h-7 px-3 rounded-md text-[10px] font-bold gap-1.5 bg-blue-600 hover:bg-blue-700 shadow-sm"
                  onClick={handleDoneAndNext}
                >
                  <CheckCircle2 className="h-3.5 w-3.5" />
                  完了
                </Button>
              </div>
            </div>
            <textarea
              readOnly
              className="w-full h-32 p-4 font-mono text-[10px] bg-slate-50/50 border-t border-blue-50 focus:outline-none resize-none text-slate-600 leading-normal block"
              value={urlsText}
            />
          </Card>

          <div className="space-y-4">
            <div className="grid gap-2">
              {articles.map((article) => (
                <div 
                  key={article.id} 
                  className="group flex flex-row items-center gap-4 p-3 rounded-xl border border-slate-200 bg-white hover:border-blue-100 hover:shadow-sm transition-all min-w-0"
                >
                  <div className="flex-1 min-w-0 py-0.5">
                    <a 
                      href={article.url} 
                      target="_blank" 
                      rel="noopener noreferrer"
                      className="group/link block"
                    >
                      <h4 className="font-bold text-slate-900 text-[13px] leading-snug line-clamp-2 group-hover/link:text-blue-600 transition-colors">
                        {article.title}
                      </h4>
                    </a>
                    <div className="flex items-center gap-2 mt-1.5">
                      <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight leading-none shrink-0">
                        {article.source || 'News Source'}
                      </div>
                      <span className="text-[9px] text-slate-400 truncate font-medium">
                        {article.url}
                      </span>
                    </div>
                  </div>
                  <div className="flex items-center gap-2 shrink-0">
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 rounded-full bg-slate-50 text-slate-400 hover:bg-blue-50 hover:text-blue-600 transition-colors border border-slate-100"
                      onClick={() => handleUpdateStatus(article.id, 'to_read')}
                      title="後で読むに移動"
                    >
                      <BookOpen className="h-4 w-4" />
                    </Button>
                    <Button 
                      variant="ghost" 
                      size="icon"
                      className="h-8 w-8 rounded-full bg-slate-50 text-slate-400 hover:bg-green-50 hover:text-green-600 transition-colors border border-slate-100"
                      onClick={() => handleUpdateStatus(article.id, 'done')}
                      title="完了にする"
                    >
                      <Check className="h-4 w-4" />
                    </Button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 text-center border-2 border-dashed rounded-2xl bg-slate-50">
          <p className="text-slate-400 font-bold text-base tracking-tight uppercase">記事はありません</p>
        </div>
      )}
    </div>
  );
}
