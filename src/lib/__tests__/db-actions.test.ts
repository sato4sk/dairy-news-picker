import { beforeEach, describe, expect, it, vi } from 'vitest';

const mockAdminDb = vi.hoisted(() => ({
  collection: vi.fn(),
  batch: vi.fn(),
}));

vi.mock('../firebase-admin', () => ({
  adminDb: mockAdminDb,
}));

import {
  batchUpdateStatus,
  getArticlesByDate,
  getFeedGroups,
  updateArticleStatus,
} from '../db-actions';

function doc(id: string, data: Record<string, unknown>) {
  return { id, data: () => data };
}

describe('db-actions', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('returns feed groups ordered by Firestore order query', async () => {
    const get = vi.fn(async () => ({
      empty: false,
      docs: [
        doc('g1', { name: 'A', order: 1, updated_at: { toDate: () => new Date('2026-05-23T00:00:00.000Z') } }),
        doc('g2', { name: 'B', order: 2 }),
      ],
    }));
    const orderBy = vi.fn(() => ({ get }));
    mockAdminDb.collection.mockReturnValue({ orderBy });

    await expect(getFeedGroups()).resolves.toEqual([
      { id: 'g1', name: 'A', order: 1, updated_at: '2026-05-23T00:00:00.000Z' },
      { id: 'g2', name: 'B', order: 2 },
    ]);
    expect(orderBy).toHaveBeenCalledWith('order', 'asc');
  });

  it('falls back to published_at query when triaged_at query fails', async () => {
    const triagedGet = vi.fn(async () => {
      throw new Error('missing index');
    });
    const fallbackGet = vi.fn(async () => ({
      docs: [doc('a1', { title: 'Fallback article' })],
    }));
    const query = {
      where: vi.fn(() => query),
      orderBy: vi.fn((field: string) => {
        return field === 'triaged_at'
          ? { get: triagedGet }
          : { get: fallbackGet };
      }),
    };
    mockAdminDb.collection.mockReturnValue(query);
    vi.spyOn(console, 'warn').mockImplementation(() => undefined);

    await expect(getArticlesByDate(new Date('2026-05-23T00:00:00.000+09:00'), 'g1')).resolves.toEqual([
      { id: 'a1', title: 'Fallback article' },
    ]);
    expect(fallbackGet).toHaveBeenCalled();
  });

  it('sets queued_at only when moving a single article to NotebookLM', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T00:00:00.000Z'));
    const update = vi.fn(async () => undefined);
    mockAdminDb.collection.mockReturnValue({ doc: vi.fn(() => ({ update })) });

    await updateArticleStatus('a1', 'to_notebook');
    await updateArticleStatus('a2', 'done');

    expect(update).toHaveBeenNthCalledWith(1, {
      status: 'to_notebook',
      queued_at: '2026-05-23T00:00:00.000Z',
    });
    expect(update).toHaveBeenNthCalledWith(2, { status: 'done' });
    vi.useRealTimers();
  });

  it('sets queued_at on batched NotebookLM updates', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-05-23T00:00:00.000Z'));
    const batch = {
      update: vi.fn(),
      commit: vi.fn(async () => undefined),
    };
    mockAdminDb.batch.mockReturnValue(batch);
    mockAdminDb.collection.mockReturnValue({ doc: vi.fn((id: string) => ({ id })) });

    await batchUpdateStatus(['a1', 'a2'], 'to_notebook');

    expect(batch.update).toHaveBeenCalledTimes(2);
    expect(batch.update).toHaveBeenCalledWith({ id: 'a1' }, {
      status: 'to_notebook',
      queued_at: '2026-05-23T00:00:00.000Z',
    });
    expect(batch.commit).toHaveBeenCalled();
    vi.useRealTimers();
  });
});
