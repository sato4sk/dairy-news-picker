'use server';

import { adminDb } from './firebase-admin';
import { Article, ArticleStatus, DailySummary, FeedGroup } from '@/types';

const ARTICLES_COLLECTION = 'articles';
const SUMMARIES_COLLECTION = 'daily_summaries';
const FEED_GROUPS_COLLECTION = 'feed_groups';

/**
 * Sanitizes Firestore data by converting Timestamps to ISO strings.
 * This is required to pass data from Server Actions to Client Components.
 */
function sanitizeFirestoreData(data: any) {
  if (!data) return data;
  const sanitized = { ...data };
  for (const key in sanitized) {
    if (sanitized[key] && typeof sanitized[key].toDate === 'function') {
      sanitized[key] = sanitized[key].toDate().toISOString();
    }
  }
  return sanitized;
}

/**
 * Feed Group Actions
 */
export async function getFeedGroups(): Promise<FeedGroup[]> {
  const snapshot = await adminDb
    .collection(FEED_GROUPS_COLLECTION)
    .orderBy('order', 'asc')
    .get();
  
  if (snapshot.empty) {
    // Fallback for transition period if order doesn't exist on any docs
    const allSnapshot = await adminDb.collection(FEED_GROUPS_COLLECTION).get();
    return allSnapshot.docs
      .map((doc) => ({
        id: doc.id,
        ...sanitizeFirestoreData(doc.data()),
      }))
      .sort((a: any, b: any) => (a.order ?? 0) - (b.order ?? 0)) as FeedGroup[];
  }

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...sanitizeFirestoreData(doc.data()),
  })) as FeedGroup[];
}

export async function saveFeedGroup(group: FeedGroup) {
  const { id, ...data } = group;
  await adminDb.collection(FEED_GROUPS_COLLECTION).doc(id).set({
    ...data,
    updated_at: new Date().toISOString(),
  }, { merge: true });
}

export async function updateFeedGroupsOrder(groupOrders: { id: string; order: number }[]) {
  const batch = adminDb.batch();
  groupOrders.forEach(({ id, order }) => {
    const ref = adminDb.collection(FEED_GROUPS_COLLECTION).doc(id);
    batch.update(ref, { order, updated_at: new Date().toISOString() });
  });
  await batch.commit();
}

export async function deleteFeedGroup(id: string) {
  await adminDb.collection(FEED_GROUPS_COLLECTION).doc(id).delete();
}

/**
 * Helper to get JST date range in UTC
 */
function getJSTDayRange(date: Date) {
  // Normalize input date to JST noon to safely get the YYYY-MM-DD in JST
  // Regardless of whether 'date' is JST midnight or UTC midnight.
  const jstOffset = 9 * 60 * 60 * 1000;
  const jstDate = new Date(date.getTime() + jstOffset);
  
  const y = jstDate.getUTCFullYear();
  const m = jstDate.getUTCMonth();
  const d = jstDate.getUTCDate();

  const jstString = `${y}-${String(m + 1).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

  // startUTC is 00:00:00 JST for that logical day
  const startUTC = new Date(Date.UTC(y, m, d, 0, 0, 0) - jstOffset);
  const endUTC = new Date(startUTC.getTime() + 24 * 60 * 60 * 1000);

  return { startUTC, endUTC, jstString };
}

export async function getArticlesByDate(date: Date, groupId: string): Promise<Article[]> {
  const { startUTC, endUTC } = getJSTDayRange(date);

  try {
    // Fetch articles triaged within the range with status 'in_feed' or 'done'
    const snapshot = await adminDb
      .collection(ARTICLES_COLLECTION)
      .where('group', '==', groupId)
      .where('status', 'in', ['in_feed', 'done'])
      .where('triaged_at', '>=', startUTC.toISOString())
      .where('triaged_at', '<', endUTC.toISOString())
      .orderBy('triaged_at', 'desc')
      .get();

    if (!snapshot.empty) {
      return snapshot.docs.map((doc) => ({
        id: doc.id,
        ...doc.data(),
      })) as Article[];
    }
  } catch (error: any) {
    // Fallback if index is missing
    console.warn('Triaged_at query failed, falling back to published_at:', error.message);
  }

  // Fallback for older articles or transition period
  const fallbackSnapshot = await adminDb
    .collection(ARTICLES_COLLECTION)
    .where('group', '==', groupId)
    .where('published_at', '>=', startUTC.toISOString())
    .where('published_at', '<', endUTC.toISOString())
    .orderBy('published_at', 'desc')
    .get();
  
  return fallbackSnapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Article[];
}

export async function getArticlesByStatus(status: ArticleStatus): Promise<Article[]> {
  const snapshot = await adminDb
    .collection(ARTICLES_COLLECTION)
    .where('status', '==', status)
    .orderBy('published_at', 'desc')
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Article[];
}

export async function getNotebookQueue(limit: number = 10): Promise<Article[]> {
  const snapshot = await adminDb
    .collection(ARTICLES_COLLECTION)
    .where('status', '==', 'to_notebook')
    .orderBy('queued_at', 'asc')
    .limit(limit)
    .get();

  return snapshot.docs.map((doc) => ({
    id: doc.id,
    ...doc.data(),
  })) as Article[];
}

export async function updateArticleStatus(id: string, status: ArticleStatus) {
  const data: any = { status };
  
  if (status === 'to_notebook') {
    data.queued_at = new Date().toISOString();
  }

  await adminDb.collection(ARTICLES_COLLECTION).doc(id).update(data);
}

export async function batchUpdateStatus(ids: string[], status: ArticleStatus) {
  const batch = adminDb.batch();
  
  ids.forEach((id) => {
    const ref = adminDb.collection(ARTICLES_COLLECTION).doc(id);
    const data: any = { status };
    if (status === 'to_notebook') {
      data.queued_at = new Date().toISOString();
    }
    batch.update(ref, data);
  });

  await batch.commit();
}

export async function getDailySummary(date: Date, groupId: string): Promise<DailySummary | null> {
  const { jstString } = getJSTDayRange(date);
  const id = `${jstString}_${groupId}`;
  const doc = await adminDb.collection(SUMMARIES_COLLECTION).doc(id).get();
  
  if (!doc.exists) return null;
  
  return {
    id: doc.id,
    ...doc.data(),
  } as DailySummary;
}
