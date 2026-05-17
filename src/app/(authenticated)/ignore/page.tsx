'use client';

import { useState, useEffect, useCallback } from 'react';
import { FEED_GROUPS } from '@/config/feeds';
import { Article, ArticleStatus } from '@/types';
import { ArticleCard } from '@/components/article-card';
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
import { getIgnoredArticlesByDate, updateArticleStatus } from '@/lib/db-actions';

export default function IgnoredArticlesPage() {
  const [articles, setArticles] = useState<Article[]>([]);
  const [selectedGroup, setSelectedGroup] = useState<string>(FEED_GROUPS[0].id);
  const [selectedDate, setSelectedDate] = useState<Date>(new Date());
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const fetchedArticles = await getIgnoredArticlesByDate(selectedDate, selectedGroup);
      setArticles(fetchedArticles);
    } catch (error) {
      console.error('Failed to fetch data:', error);
      toast.error('Failed to load ignored articles.');
    } finally {
      setLoading(false);
    }
  }, [selectedDate, selectedGroup]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const handleTriage = async (id: string, newStatus: ArticleStatus) => {
    // Note: Ignored articles are already 'done', so ArticleCard will show them as triaged.
    // If we want to allow re-triaging, we'd need to change status to 'in_feed' first or modify ArticleCard.
    // For now, we follow the mirror UI.
    try {
      await updateArticleStatus(id, newStatus);
      toast.success(`Article moved to ${newStatus}`);
      // Refresh to reflect changes if necessary
      fetchData();
    } catch (error) {
      console.error('Failed to update status:', error);
      toast.error('Failed to update status.');
    }
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
            <h2 className="text-3xl font-bold tracking-tight">Ignored (AI)</h2>
            <p className="text-slate-500">Review articles that were filtered out by AI.</p>
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
          <p className="text-slate-500 font-medium">Fetching ignored articles...</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="flex items-center justify-between border-b pb-2">
            <h3 className="text-xl font-bold capitalize text-slate-800 flex items-center gap-2">
              Ignored Articles
              <span className="text-sm font-medium text-slate-400 bg-slate-100 px-2 py-0.5 rounded-full">
                {articles.length}
              </span>
            </h3>
          </div>

          {articles.length > 0 ? (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              {articles.map((article) => (
                <ArticleCard
                  key={article.id}
                  article={article}
                  onTriage={handleTriage}
                />
              ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-20 text-center border-2 border-dashed rounded-2xl bg-slate-50">
              <p className="text-slate-400 font-medium">No ignored articles for this date and group.</p>
            </div>
          )}
        </div>
      )}
    </div>
  );
}
