'use client';

import { useState, useEffect } from 'react';
import { Article, ArticleStatus, ArticleCategory, DailySummary, FeedGroup } from '@/types';
import { ArticleCard } from '@/components/article-card';
import { toast } from 'sonner';
import { format } from 'date-fns';
import { ja } from 'date-fns/locale';
import { Calendar as CalendarIcon, ChevronLeft, ChevronRight, ChevronDown, Loader2, Check } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Calendar } from '@/components/ui/calendar';
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from '@/components/ui/popover';
import { getArticlesByDate, updateArticleStatus, getDailySummary, getFeedGroups, batchUpdateStatus } from '@/lib/db-actions';

const VISIBLE_CATEGORIES = ['core', 'related', 'random', 'ignore'] as const satisfies readonly ArticleCategory[];
type VisibleCategory = (typeof VISIBLE_CATEGORIES)[number];

export default function TriagePage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [summary, setSummary] = useState<DailySummary | null>(null);
  const [groups, setGroups] = useState<FeedGroup[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>('');
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);
  const [collapsedCategories, setCollapsedCategories] = useState<Record<string, boolean>>({
    ignore: true,
  });

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

  useEffect(() => {
    async function fetchData() {
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
    }
    fetchData();
  }, [selectedDate, selectedGroup]);

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

  const handleMarkAllAsDone = async () => {
    const untriagedArticles = articles.filter(
      (a) => a.status === 'in_feed'
    );
    
    if (untriagedArticles.length === 0) return;

    const ids = untriagedArticles.map((a) => a.id);
    const previousArticles = [...articles];
    
    // Optimistic UI update
    setArticles((prev) =>
      prev.map((a) => ids.includes(a.id) ? { ...a, status: 'done' } : a)
    );

    try {
      await batchUpdateStatus(ids, 'done');
      toast.success(`${ids.length} articles marked as done`);
    } catch (error) {
      setArticles(previousArticles);
      console.error('Failed to mark all as done:', error);
      toast.error('Failed to update articles.');
    }
  };

  const categorizedArticles: Record<VisibleCategory, Article[]> = {
    core: articles.filter((a) => a.category === 'core'),
    related: articles.filter((a) => a.category === 'related'),
    random: articles.filter((a) => a.category === 'random'),
    ignore: articles.filter((a) => a.category === 'ignore'),
  };

  const toggleCategory = (category: string) => {
    setCollapsedCategories(prev => ({
      ...prev,
      [category]: !prev[category]
    }));
  };

  const changeDate = (days: number) => {
    const newDate = new Date(selectedDate);
    newDate.setDate(newDate.getDate() + days);
    setSelectedDate(newDate);
  };

  return (
    <div className="space-y-8 pb-20">
      <header className="flex flex-col gap-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <h2 className="text-3xl font-bold tracking-tight">Morning Triage</h2>
            <p className="text-slate-500">Review and categorize today&apos;s news.</p>
          </div>
        </div>

        <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
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
              <PopoverTrigger asChild>
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
            {VISIBLE_CATEGORIES.map((category) => {
              const isCollapsed = collapsedCategories[category];
              const inFeedCount = categorizedArticles[category].filter(a => a.status === 'in_feed').length;
              return (
                <section key={category} className="space-y-4">
                  <button 
                    onClick={() => toggleCategory(category)}
                    className="flex w-full items-center justify-between border-b pb-2 text-left hover:opacity-70 transition-opacity"
                  >
                    <h3 className="text-xl font-bold capitalize text-slate-800 flex items-center gap-2">
                      {isCollapsed ? <ChevronRight className="h-5 w-5 text-slate-400" /> : <ChevronDown className="h-5 w-5 text-slate-400" />}
                      {category}
                      {inFeedCount > 0 && (
                        <span className="text-sm font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                          {inFeedCount}
                        </span>
                      )}
                    </h3>
                  </button>

                  {!isCollapsed && (
                    <div className="animate-in fade-in slide-in-from-top-2 duration-300">
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
                    </div>
                  )}
                </section>
              );
            })}
          </div>

          <div className="flex justify-center mt-12">
            <Button
              onClick={handleMarkAllAsDone}
              size="lg"
              className="rounded-full px-8 font-bold gap-2"
            >
              <Check className="h-5 w-5" />
              Mark all as done
            </Button>
          </div>
        </>
      )}
    </div>
  );
}
