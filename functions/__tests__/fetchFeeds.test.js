const { createFetchFeeds, extractRecentUniqueArticles, articleIdFromUrl } = require('../fetchFeeds');

function createRes() {
  return {
    statusCode: undefined,
    body: undefined,
    status: vi.fn(function status(code) {
      this.statusCode = code;
      return this;
    }),
    send: vi.fn(function send(body) {
      this.body = body;
      return this;
    }),
  };
}

function createDb({ groups, existingIds = [] }) {
  const writes = [];
  const collections = {};
  const batch = {
    set: vi.fn((ref, data, options) => writes.push({ type: 'set', path: ref.path, data, options })),
    commit: vi.fn(async () => undefined),
  };

  const collection = vi.fn((name) => {
    if (!collections[name]) {
      collections[name] = {
        doc: vi.fn((id) => ({ id, path: `${name}/${id}` })),
        get: vi.fn(async () => ({
          docs: name === 'feed_groups'
            ? groups.map((group) => ({ id: group.id, data: () => ({ ...group }) }))
            : [],
        })),
        where: vi.fn(function where() {
          return this;
        }),
        count: vi.fn(() => ({
          get: vi.fn(async () => ({ data: () => ({ count: 2 }) })),
        })),
      };
    }
    return collections[name];
  });

  return {
    collection,
    batch: vi.fn(() => batch),
    getAll: vi.fn(async (...refs) => refs.map((ref) => ({
      id: ref.id,
      exists: existingIds.includes(ref.id),
    }))),
    writes,
    batchRef: batch,
  };
}

describe('fetchFeeds', () => {
  it('extracts recent unique articles and filters old or empty URLs', () => {
    const now = new Date('2026-05-23T00:00:00.000Z');
    const recent = '2026-05-22T20:00:00.000Z';
    const old = '2026-05-22T00:00:00.000Z';

    const { rawArticles, uniqueArticlesMap } = extractRecentUniqueArticles([
      {
        title: 'Feed',
        items: [
          { title: 'A', link: 'https://example.com/a', pubDate: recent, contentSnippet: 'a' },
          { title: 'A duplicate', link: 'https://example.com/a', pubDate: recent, contentSnippet: 'a2' },
          { title: 'Old', link: 'https://example.com/old', pubDate: old, contentSnippet: 'old' },
          { title: 'Missing URL', link: '', pubDate: recent, contentSnippet: 'missing' },
        ],
      },
    ], now);

    expect(rawArticles).toHaveLength(2);
    expect(uniqueArticlesMap).toHaveLength(1);
    expect(uniqueArticlesMap.get(articleIdFromUrl('https://example.com/a')).title).toBe('A');
  });

  it('creates new articles with is_triaged=false and preserves status/is_triaged for existing articles', async () => {
    const newUrl = 'https://example.com/new';
    const existingUrl = 'https://example.com/existing';
    const existingId = articleIdFromUrl(existingUrl);
    const db = createDb({
      groups: [{ id: 'g1', name: 'Group 1', feeds: ['https://feed.example/rss'] }],
      existingIds: [existingId],
    });
    const parser = {
      parseURL: vi.fn(async () => ({
        title: 'Feed title',
        items: [
          { title: 'New', link: newUrl, pubDate: '2026-05-22T23:00:00.000Z', contentSnippet: 'new text' },
          { title: 'Existing', link: existingUrl, pubDate: '2026-05-22T23:30:00.000Z', contentSnippet: 'existing text' },
        ],
      })),
    };
    const res = createRes();
    const handler = createFetchFeeds({
      db,
      parser,
      now: () => new Date('2026-05-23T00:00:00.000Z'),
      logger: { log: vi.fn(), error: vi.fn() },
    });

    await handler({}, res);

    const newWrite = db.writes.find((write) => write.path.endsWith(articleIdFromUrl(newUrl)));
    const existingWrite = db.writes.find((write) => write.path.endsWith(existingId));

    expect(res.status).toHaveBeenCalledWith(200);
    expect(newWrite.data).toMatchObject({ title: 'New', is_triaged: false, group: 'g1' });
    expect(existingWrite.data).toMatchObject({ title: 'Existing', group: 'g1' });
    expect(existingWrite.data).not.toHaveProperty('status');
    expect(existingWrite.data).not.toHaveProperty('is_triaged');
    expect(existingWrite.options).toEqual({ merge: true });
  });
});
