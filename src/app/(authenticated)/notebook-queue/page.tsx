'use client';

import { useState, useEffect } from 'react';
import { Article } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Copy, Check, CheckCircle2, Loader2 } from 'lucide-react';
import { toast } from 'sonner';
import { getNotebookQueue, batchUpdateStatus } from '@/lib/db-actions';

export default function NotebookQueuePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  async function fetchData() {
    setLoading(true);
    try {
      const fetched = await getNotebookQueue(10);
      setArticles(fetched);
    } catch (error) {
      console.error('Failed to fetch queue:', error);
      toast.error('Failed to load queue.');
    } finally {
      setLoading(false);
    }
  }

  useEffect(() => {
    fetchData();
  }, []);

  const urlsText = articles.map(a => a.url).join('\r\n');

  const handleCopy = async () => {
    if (urlsText) {
      try {
        await navigator.clipboard.writeText(urlsText);
      } catch (err) {
        console.error('Clipboard API failed, using fallback:', err);
        const textArea = document.createElement("textarea");
        textArea.value = urlsText;
        // Ensure the textarea is not visible but part of the DOM
        textArea.style.position = "fixed";
        textArea.style.left = "-9999px";
        textArea.style.top = "0";
        document.body.appendChild(textArea);
        textArea.focus();
        textArea.select();
        try {
          document.execCommand('copy');
        } catch (copyErr) {
          console.error('Fallback copy failed:', copyErr);
        }
        document.body.removeChild(textArea);
      }
      setCopied(true);
      toast.success('URLs copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    }
  };

  const handleDoneAndNext = async () => {
    const ids = articles.map(a => a.id);
    if (ids.length === 0) return;

    try {
      await batchUpdateStatus(ids, 'done');
      toast.success(`${ids.length} articles marked as done`);
      fetchData(); // Load next batch
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status.');
    }
  };

  return (
    <div className="space-y-8 pb-10">
      <header>
        <h2 className="text-3xl font-bold tracking-tight">NotebookLM Queue</h2>
        <p className="text-slate-500">Copy URLs to NotebookLM and mark as done.</p>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-slate-500 font-medium">Loading queue...</p>
        </div>
      ) : articles.length > 0 ? (
        <div className="space-y-6">
          <Card className="overflow-hidden border-2 border-blue-100">
            <CardHeader className="bg-blue-50/50 pb-4">
              <CardTitle className="flex items-center justify-between text-lg">
                Batch URLs ({articles.length})
                <Button 
                  variant="outline" 
                  size="sm" 
                  onClick={handleCopy}
                  className="gap-2 bg-white"
                >
                  {copied ? <Check className="h-4 w-4" /> : <Copy className="h-4 w-4" />}
                  {copied ? 'Copied' : 'Copy All'}
                </Button>
              </CardTitle>
            </CardHeader>
            <CardContent className="p-0">
              <textarea
                readOnly
                className="w-full h-48 p-4 font-mono text-sm bg-slate-50 border-0 focus:ring-0 resize-none"
                value={urlsText}
              />
            </CardContent>
            <CardFooter className="bg-blue-50/50 border-t p-4 flex justify-end">
              <Button 
                size="lg" 
                className="h-14 px-8 rounded-xl font-bold gap-2 bg-blue-600 hover:bg-blue-700"
                onClick={handleDoneAndNext}
              >
                <CheckCircle2 className="h-6 w-6" />
                Done & Next Batch
              </Button>
            </CardFooter>
          </Card>

          <div className="space-y-4">
            <h3 className="text-lg font-bold text-slate-900 px-1">Articles in this batch</h3>
            <div className="grid gap-3">
              {articles.map((article) => (
                <div key={article.id} className="flex items-center gap-4 p-4 rounded-xl border bg-white shadow-sm">
                  <div className="flex-1 truncate">
                    <p className="font-bold text-slate-900 truncate">{article.title}</p>
                    <p className="text-xs text-slate-500 truncate">{article.url}</p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      ) : (
        <div className="flex flex-col items-center justify-center py-40 text-center border-2 border-dashed rounded-2xl bg-slate-50">
          <p className="text-slate-400 font-medium text-lg">No articles in the NotebookLM queue.</p>
          <p className="text-slate-400 text-sm">Send some interesting articles here from Triage!</p>
        </div>
      )}
    </div>
  );
}
