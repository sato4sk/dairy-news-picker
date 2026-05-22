'use client';

import { Article } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Library } from 'lucide-react';

interface ArticleCardProps {
  article: Article;
  onTriage?: (id: string, status: Article['status']) => void;
  children?: React.ReactNode;
  isTriaged?: boolean;
}

export function ArticleCard({ article, onTriage, children, isTriaged: isTriagedProp }: ArticleCardProps) {
  // Logic for determining if an article has already been triaged.
  // We consider it "triaged" if it's moved to a special queue (to_read, to_notebook).
  // 'done' articles in the triage screen represent dismissed/already read articles,
  // so they should also be grayed out to distinguish them from 'in_feed'.
  const isTriaged = isTriagedProp ?? (article.status !== 'in_feed');

  return (
    <Card className={`group/card flex flex-row h-full overflow-hidden transition-all duration-300 border-slate-200 p-0 gap-0 ${
      isTriaged ? 'opacity-60 grayscale-[0.8] bg-slate-50 shadow-none' : 'hover:shadow-md'
    }`}>
      <div className="flex-1 flex flex-col min-w-0 py-1.5">
        <CardHeader className="px-4 py-0.5">
          <a 
            href={article.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="group/link transition-colors"
          >
            <CardTitle className={`text-sm font-bold leading-tight transition-colors line-clamp-2 ${
              isTriaged ? 'text-slate-500' : 'group-hover/link:text-blue-600 text-slate-900'
            }`}>
              {article.title}
            </CardTitle>
          </a>
        </CardHeader>
        <CardContent className="px-4 py-0.5 selection-enabled flex flex-col gap-1">
          <p className="text-slate-600 text-[11px] leading-relaxed line-clamp-2">
            {article.description}
          </p>
          <div className="text-[9px] font-bold text-slate-400 uppercase tracking-tight leading-none mt-1">
            {article.source || 'ニュースソース'}
          </div>
        </CardContent>
      </div>

      <div className="relative flex flex-col border-l bg-slate-50/50 w-11 shrink-0">
        {children ? (
          children
        ) : (
          <>
            <button 
              className={`flex-1 flex items-center justify-center transition-colors border-b border-slate-200 ${
                article.status === 'to_read' 
                  ? 'bg-blue-100 text-blue-600' 
                  : 'hover:bg-blue-50 hover:text-blue-600 text-slate-400'
              }`}
              onClick={() => onTriage?.(article.id, 'to_read')}
              title="後で読む"
              disabled={isTriaged && article.status !== 'done'}
            >
              <BookOpen className="h-4 w-4" />
            </button>
            <button 
              className={`flex-1 flex items-center justify-center transition-colors ${
                article.status === 'to_notebook' 
                  ? 'bg-purple-100 text-purple-600' 
                  : 'hover:bg-purple-50 hover:text-purple-600 text-slate-400'
              }`}
              onClick={() => onTriage?.(article.id, 'to_notebook')}
              title="NotebookLMに追加"
              disabled={isTriaged && article.status !== 'done'}
            >
              <Library className="h-4 w-4" />
            </button>
          </>
        )}
      </div>
    </Card>
  );
}
