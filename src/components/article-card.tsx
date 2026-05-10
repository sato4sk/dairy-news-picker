'use client';

import { Article } from '@/types';
import { Card, CardContent, CardFooter, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { BookOpen, Library, X } from 'lucide-react';

interface ArticleCardProps {
  article: Article;
  onTriage: (id: string, status: Article['status']) => void;
}

export function ArticleCard({ article, onTriage }: ArticleCardProps) {
  return (
    <Card className="flex flex-col h-full overflow-hidden transition-shadow hover:shadow-md">
      <CardHeader className="pb-3">
        <div className="flex justify-between items-start gap-4">
          <a 
            href={article.url} 
            target="_blank" 
            rel="noopener noreferrer"
            className="group"
          >
            <CardTitle className="text-lg font-bold leading-snug group-hover:text-blue-600 transition-colors">
              {article.title}
            </CardTitle>
          </a>
        </div>
      </CardHeader>
      <CardContent className="flex-1 pb-4 selection-enabled">
        <p className="text-slate-600 text-sm leading-relaxed line-clamp-4">
          {article.description}
        </p>
      </CardContent>
      <CardFooter className="grid grid-cols-3 gap-2 p-3 bg-slate-50/50 border-t">
        <Button 
          variant="outline" 
          size="lg"
          className="h-16 flex-col gap-1 rounded-xl border-red-100 hover:bg-red-50 hover:text-red-600"
          onClick={() => onTriage(article.id, 'done')}
        >
          <X className="h-6 w-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Skip</span>
        </Button>
        <Button 
          variant="outline" 
          size="lg"
          className="h-16 flex-col gap-1 rounded-xl border-blue-100 hover:bg-blue-50 hover:text-blue-600"
          onClick={() => onTriage(article.id, 'to_read')}
        >
          <BookOpen className="h-6 w-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">Read Later</span>
        </Button>
        <Button 
          variant="outline" 
          size="lg"
          className="h-16 flex-col gap-1 rounded-xl border-purple-100 hover:bg-purple-50 hover:text-purple-600"
          onClick={() => onTriage(article.id, 'to_notebook')}
        >
          <Library className="h-6 w-6" />
          <span className="text-[10px] font-bold uppercase tracking-wider">NotebookLM</span>
        </Button>
      </CardFooter>
    </Card>
  );
}
