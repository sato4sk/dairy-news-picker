'use server';

import { adminDb } from './firebase-admin';
import { Article, ArticleStatus, DailySummary } from '@/types';
import { startOfDay, endOfDay, format } from 'date-fns';

const ARTICLES_COLLECTION = 'articles';
const SUMMARIES_COLLECTION = 'daily_summaries';

export async function getArticlesByDate(date: Date, groupId: string): Promise<Article[]> {
  const start = startOfDay(date);
  const end = endOfDay(date);

  const snapshot = await adminDb
    .collection(ARTICLES_COLLECTION)
    .where('group', '==', groupId)
    .where('published_at', '>=', start.toISOString())
    .where('published_at', '<=', end.toISOString())
    .orderBy('published_at', 'desc')
    .get();

  return snapshot.docs.map((doc) => ({
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
  const id = `${format(date, 'yyyy-MM-dd')}_${groupId}`;
  const doc = await adminDb.collection(SUMMARIES_COLLECTION).doc(id).get();
  
  if (!doc.exists) return null;
  
  return {
    id: doc.id,
    ...doc.data(),
  } as DailySummary;
}
