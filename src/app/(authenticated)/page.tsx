'use client';

import { useState, useEffect, useCallback } from 'react';
import { FEED_GROUPS } from '@/config/feeds';
import { Article, ArticleStatus, ArticleCategory, DailySummary } from '@/types';
import { ArticleCard } from '@/components/article-card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getArticlesByDate, updateArticleStatus, getDailySummary } from '@/lib/db-actions';

export default function TriagePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [selectedGroup, setSelectedGroup] = useState<string>(FEED_GROUPS[0].id);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [fetchedArticles, fetchedSummary] = await Promise.all([
        getArticlesByDate(selectedDate, selectedGroup),
        getDailySummary(selectedDate, selectedGroup),
      ]);
      setArticles(fetchedArticles);
      setSummary(fetchedSummary);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load articles from database.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedGroup]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTriage = async (id: string, newStatus: ArticleStatus) => {
    // Optimistic UI update
    const article = articles.find((a) => a.id === id);
    setArticles((prev) => prev.filter((a) => a.id !== id));

    try {
      await updateArticleStatus(id, newStatus);
      toast.success(`Article moved to ${newStatus}`);
    } catch (error) {
      // Revert on failure
      if (article) setArticles((prev) => [...prev, article]);
      console.error('Failed to update status:', error);
      toast.error('Failed to update status in database.');
    }
  };

  const filteredArticles = articles.filter((a) => a.status === 'in_feed');

  const categorizedArticles: Record<ArticleCategory, Article[]> = {
    core: filteredArticles.filter((a) => a.category === 'core'),
    related: filteredArticles.filter((a) => a.category === 'related'),
    random: filteredArticles.filter((a) => a.category === 'random'),
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  return (
    <div className="space-y-8 pb-10">
      <header className="flex flex-col gap-6 sm:flex-row sm:items-end sm:justify-between">
        <div className="space-y-4">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Morning Triage</h2>
            <p className="text-slate-500">Review and categorize today's news.</p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => changeDate(-1)}
            >
              <ChevronLeft className="h-5 w-5" />
            </Button>

            <Popover>
              <PopoverTrigger>
                <Button
                  variant="outline"
                  className="h-10 px-4 py-2 font-bold flex items-center gap-2 rounded-full border-2 border-blue-100 hover:border-blue-200"
                >
                  <CalendarIcon className="h-4 w-4 text-blue-600" />
                  {format(selectedDate, 'yyyy年MM月dd日 (eee)', { locale: ja })}
                </Button>
              </PopoverTrigger>
              <PopoverContent className="w-auto p-0" align="start">
                <Calendar
                  mode="single"
                  selected={selectedDate}
                  onSelect={(date) => date && setSelectedDate(date)}
                  initialFocus
                />
              </PopoverContent>
            </Popover>

            <Button
              variant="outline"
              size="icon"
              className="h-10 w-10 rounded-full"
              onClick={() => changeDate(1)}
            >
              <ChevronRight className="h-5 w-5" />
            </Button>
          </div>
        </div>

        <div className="flex items-center gap-2 overflow-x-auto pb-2 sm:pb-0">
          {FEED_GROUPS.map((group) => (
            <button
              key={group.id}
              onClick={() => setSelectedGroup(group.id)}
              className={`whitespace-nowrap rounded-full px-4 py-2 text-sm font-medium transition-colors ${
                selectedGroup === group.id
                  ? 'bg-blue-600 text-white'
                  : 'bg-white text-slate-600 hover:bg-slate-100 border'
              }`}
            >
              {group.name}
            </button>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex flex-col items-center justify-center py-40 gap-4">
          <Loader2 className="h-10 w-10 animate-spin text-blue-600" />
          <p className="text-slate-500 font-medium">Fetching news articles...</p>
        </div>
      ) : (
        <>
          <section className="rounded-2xl border bg-white p-6 shadow-sm md:p-8 selection-enabled">
            <h3 className="mb-4 flex items-center gap-2 text-lg font-bold text-slate-900">
              <span className="flex h-6 w-6 items-center justify-center rounded-full bg-blue-100 text-xs text-blue-700">AI</span>
              Today's Summary
            </h3>
            <p className="text-slate-600 leading-relaxed md:text-lg">
              {summary?.content || "No summary available for this date and group."}
            </p>
          </section>

          <Tabs defaultValue="core" className="w-full">
            <TabsList className="grid w-full grid-cols-3 h-14 bg-slate-100 p-1 rounded-xl">
              <TabsTrigger value="core" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600">
                Core ({categorizedArticles.core.length})
              </TabsTrigger>
              <TabsTrigger value="related" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600">
                Related ({categorizedArticles.related.length})
              </TabsTrigger>
              <TabsTrigger value="random" className="rounded-lg font-bold data-[state=active]:bg-white data-[state=active]:text-blue-600">
                Random ({categorizedArticles.random.length})
              </TabsTrigger>
            </TabsList>

            {(['core', 'related', 'random'] as const).map((category) => (
              <TabsContent key={category} value={category} className="mt-6">
                {categorizedArticles[category].length > 0 ? (
                  <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-2">
                    {categorizedArticles[category].map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        onTriage={handleTriage}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl bg-slate-50">
                    <p className="text-slate-400 font-medium text-lg">No more articles in this category.</p>
                    <p className="text-slate-400 text-sm">You're all caught up!</p>
                  </div>
                )}
              </TabsContent>
            ))}
          </Tabs>
        </>
      )}
    </div>
  );
}
