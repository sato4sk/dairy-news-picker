const {
  normalizeUrl,
  normalizeTitle,
  deduplicateArticles,
  callGemini,
  getTriageDay,
  MODELS,
} = require('../triageArticles');

function createDb() {
  const updates = [];
  const batch = {
    update: vi.fn((ref, data) => updates.push({ path: ref.path, data })),
    commit: vi.fn(async () => undefined),
  };
  return {
    collection: vi.fn((name) => ({
      doc: vi.fn((id) => ({ id, path: `${name}/${id}` })),
    })),
    batch: vi.fn(() => batch),
    updates,
  };
}

describe('triageArticles helpers', () => {
  it('normalizes tracking URLs and title whitespace', () => {
    expect(normalizeUrl('HTTPS://Example.com/News/?utm_source=rss&keep=1#frag')).toBe('https://example.com/news?keep=1');
    expect(normalizeUrl('https://example.com/news/')).toBe('https://example.com/news');
    expect(normalizeTitle('  Dairy\n News\tToday  ')).toBe('dairynewstoday');
  });

  it('marks duplicate articles done and returns only unique articles', async () => {
    const db = createDb();
    const articles = [
      { id: 'a1', url: 'https://example.com/news?utm_source=rss', title: 'Same title' },
      { id: 'a2', url: 'https://example.com/news', title: 'Different title' },
      { id: 'a3', url: 'https://example.com/other', title: ' Same  title ' },
    ];

    const unique = await deduplicateArticles(articles, db);

    expect(unique.map((article) => article.id)).toEqual(['a1']);
    expect(db.updates).toHaveLength(2);
    expect(db.updates[0].data).toMatchObject({
      status: 'done',
      is_triaged: true,
      category: 'duplicated',
      duplicate_of: 'a1',
    });
  });

  it('switches model immediately on 429 and retries 5xx with backoff', async () => {
    const generateContent = vi.fn()
      .mockRejectedValueOnce(Object.assign(new Error('429 quota'), { status: 429 }))
      .mockRejectedValueOnce(Object.assign(new Error('503 unavailable'), { status: 503 }))
      .mockResolvedValueOnce({ text: JSON.stringify({ ok: true }) });
    const sleepFn = vi.fn(async () => undefined);

    const result = await callGemini('prompt', { type: 'object' }, 0, { models: { generateContent } }, sleepFn);

    expect(result).toEqual({ result: { ok: true }, nextIndex: 1 });
    expect(generateContent).toHaveBeenNthCalledWith(1, expect.objectContaining({ model: MODELS[0] }));
    expect(generateContent).toHaveBeenNthCalledWith(2, expect.objectContaining({ model: MODELS[1] }));
    expect(generateContent).toHaveBeenNthCalledWith(3, expect.objectContaining({ model: MODELS[1] }));
    expect(sleepFn).toHaveBeenCalledWith(1000);
  });

  it('uses JST date for daily summary IDs', () => {
    expect(getTriageDay(new Date('2026-05-22T14:59:59.000Z'))).toBe('2026-05-22');
    expect(getTriageDay(new Date('2026-05-22T15:00:00.000Z'))).toBe('2026-05-23');
  });
});
