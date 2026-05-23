import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { ArticleCard } from '../article-card';
import type { Article } from '@/types';

const baseArticle: Article = {
  id: 'a1',
  title: 'Dairy market news',
  url: 'https://example.com/news',
  source: 'Example Feed',
  description: 'Market update',
  group: 'g1',
  category: 'core',
  status: 'in_feed',
  published_at: '2026-05-23T00:00:00.000Z',
  triaged_at: null,
  queued_at: null,
};

describe('ArticleCard', () => {
  it('renders article details and dispatches triage actions for in-feed articles', async () => {
    const user = userEvent.setup();
    const onTriage = vi.fn();

    render(<ArticleCard article={baseArticle} onTriage={onTriage} />);

    expect(screen.getByRole('link', { name: 'Dairy market news' })).toHaveAttribute('href', baseArticle.url);
    expect(screen.getByText('Market update')).toBeInTheDocument();
    expect(screen.getByText('Example Feed')).toBeInTheDocument();

    await user.click(screen.getByTitle('後で読む'));
    await user.click(screen.getByTitle('NotebookLMに追加'));

    expect(onTriage).toHaveBeenNthCalledWith(1, 'a1', 'to_read');
    expect(onTriage).toHaveBeenNthCalledWith(2, 'a1', 'to_notebook');
  });

  it('disables queue buttons for articles already moved out of the feed', () => {
    render(<ArticleCard article={{ ...baseArticle, status: 'to_read' }} />);

    expect(screen.getByTitle('後で読む')).toBeDisabled();
    expect(screen.getByTitle('NotebookLMに追加')).toBeDisabled();
  });
});
