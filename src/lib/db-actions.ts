'use server';

import { adminDb } from './firebase-admin';
import { Article, ArticleStatus, DailySummary } from '@/types';
import { addHours, subHours, format } from 'date-fns';

const ARTICLES_COLLECTION = 'articles';
const SUMMARIES_COLLECTION = 'daily_summaries';

/**
 * Helper to get JST date range in UTC
 */
function getJSTDayRange(date: Date) {
  // If 'date' is passed from client (JST 00:00), it's already subHours(jst00, 9) in UTC.
  // To be safe and environment-independent, we normalize to JST "logical day".
  const jstDate = addHours(date, 9);
  const y = jstDate.getUTCFullYear();
  const m = jstDate.getUTCMonth();
  const d = jstDate.getUTCDate();

  // startJST is 00:00:00 JST
  const startUTC = subHours(new Date(Date.UTC(y, m, d, 0, 0, 0)), 9);
  const endUTC = addHours(startUTC, 24);

  return { startUTC, endUTC, jstString: format(jstDate, 'yyyy-MM-dd') };
}

export async function getArticlesByDate(date: Date, groupId: string): Promise<Article[]> {
  const { startUTC, endUTC } = getJSTDayRange(date);

  try {
    // Try fetching by triaged_at (new logic)
    const snapshot = await adminDb
      .collection(ARTICLES_COLLECTION)
      .where('group', '==', groupId)
      .where('status', '==', 'in_feed')
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
    .where('status', '==', 'in_feed')
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
