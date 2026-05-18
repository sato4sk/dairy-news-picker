'use client';

import { Article } from '@/types';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { BookOpen, Library, Check } from 'lucide-react';

interface ArticleCardProps {
  article: Article;
  onTriage?: (id: string, status: Article['status']) => void;
  children?: React.ReactNode;
  isTriaged?: boolean;
}

export function ArticleCard({ article, onTriage, children, isTriaged: isTriagedProp }: ArticleCardProps) {
  // Logic for determining if an article has already been triaged.
  // 1. AI Ignored articles (category is 'ignore'):
  //    Considered "untriaged" on the Ignored page so user can rescue them.
  //    Triaged if status moves away from 'done'.
  // 2. Normal articles: triaged if status is not 'in_feed'.
  const isTriaged = isTriagedProp ?? (article.category === 'ignore' 
    ? article.status !== 'done' 
    : article.status !== 'in_feed');

  return (
    <Card className={`group/card flex flex-row h-full overflow-hidden transition-all duration-300 border-slate-200 p-0 gap-0 ${
      isTriaged ? 'opacity-60 grayscale-[0.8] bg-slate-50 shadow-none' : 'hover:shadow-md'
    }`}>
      <div className="flex-1 flex flex-col min-w-0 py-2">
        <CardHeader className="px-4 py-0.5">
          <a 
            href={article.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className={`group/link transition-colors ${isTriaged ? 'pointer-events-none' : ''}`}
          >
            <CardTitle className={`text-base font-bold leading-tight transition-colors line-clamp-2 ${
              isTriaged ? 'text-slate-500' : 'group-hover/link:text-blue-600 text-slate-900'
            }`}>
              {article.title}
            </CardTitle>
          </a>
        </CardHeader>
        <CardContent className="px-4 py-0.5 selection-enabled flex flex-col gap-1.5">
          <p className="text-slate-600 text-xs leading-relaxed line-clamp-3">
            {article.description}
          </p>
          <div className="text-[9px] font-medium text-slate-400 uppercase tracking-tight leading-none mt-1">
            {article.source || 'News Source'}
          </div>
        </CardContent>
      </div>

      <div className="relative flex flex-col border-l bg-slate-50/50 w-12 shrink-0">
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
              title="Read Later"
              disabled={isTriaged}
            >
              <BookOpen className="h-5 w-5" />
            </button>
            <button 
              className={`flex-1 flex items-center justify-center transition-colors ${
                article.status === 'to_notebook' 
                  ? 'bg-purple-100 text-purple-600' 
                  : 'hover:bg-purple-50 hover:text-purple-600 text-slate-400'
              }`}
              onClick={() => onTriage?.(article.id, 'to_notebook')}
              title="NotebookLM"
              disabled={isTriaged}
            >
              <Library className="h-5 w-5" />
            </button>
          </>
        )}
        {isTriaged && (
          <div className="absolute inset-0 flex items-center justify-center bg-slate-200/50 text-slate-600">
            <Check className="h-6 w-6" />
          </div>
        )}
      </div>
    </Card>
  );
}
