'use client';

import { useState, useEffect, useCallback } from 'react';
import { Article, ArticleStatus, ArticleCategory, DailySummary, FeedGroup } from '@/types';
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
import { getArticlesByDate, updateArticleStatus, getDailySummary, getFeedGroups } from '@/lib/db-actions';

const VISIBLE_CATEGORIES = ['core', 'related', 'random'] as const satisfies readonly ArticleCategory[];
type VisibleCategory = (typeof VISIBLE_CATEGORIES)[number];

export default function TriagePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [groups, setGroups] = useState<FeedGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function initGroups() {
      try {
        const fetchedGroups = await getFeedGroups();
        setGroups(fetchedGroups);
        if (fetchedGroups.length > 0) {
          setSelectedGroup(fetchedGroups[0].id);
        }
      } catch (error) {
        console.error('Failed to load groups:', error);
        toast.error('Failed to load feed groups');
      }
    }
    initGroups();
  }, []);

  const fetchData = useCallback(async () => {
    if (!selectedGroup) return;
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
    // Optimistic UI update: Update status in place to avoid layout shift
    const previousArticles = [...articles];
    setArticles((prev) => 
      prev.map((a) => a.id === id ? { ...a, status: newStatus } : a)
    );

    try {
      await updateArticleStatus(id, newStatus);
      toast.success(`Article moved to ${newStatus}`);
    } catch (error) {
      // Revert on failure
      setArticles(previousArticles);
      console.error('Failed to update status:', error);
      toast.error('Failed to update status in database.');
    }
  };

  // We now show articles that are 'in_feed' OR were just triaged to 'to_read'/'to_notebook'/'done'
  // to keep them visible for feedback.
  const filteredArticles = articles;

  const categorizedArticles: Record<VisibleCategory, Article[]> = {
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
            <p className="text-slate-500">Review and categorize today&apos;s news.</p>
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
          {groups.map((group) => (
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
              Today&apos;s Summary
            </h3>
            <p className="text-slate-700 leading-relaxed text-base whitespace-pre-wrap">
              {summary?.content || "No summary available for this date and group."}
            </p>
          </section>

          <div className="space-y-10">
            {VISIBLE_CATEGORIES.map((category) => (
              <section key={category} className="space-y-4">
                <div className="flex items-center justify-between border-b pb-2">
                  <h3 className="text-xl font-bold capitalize text-slate-800 flex items-center gap-2">
                    {category}
                    <span className="text-sm font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                      {categorizedArticles[category].length}
                    </span>
                  </h3>
                </div>

                {categorizedArticles[category].length > 0 ? (
                  <div className="grid grid-cols-1 gap-3">
                    {categorizedArticles[category].map((article) => (
                      <ArticleCard
                        key={article.id}
                        article={article}
                        onTriage={handleTriage}
                      />
                    ))}
                  </div>
                ) : (
                  <div className="flex flex-col items-center justify-center py-10 text-center border-2 border-dashed rounded-2xl bg-slate-50">
                    <p className="text-slate-400 font-medium">No articles in {category}.</p>
                  </div>
                )}
              </section>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
