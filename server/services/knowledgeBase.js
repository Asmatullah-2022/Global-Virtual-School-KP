// Simple keyword-based retrieval over the admin-managed GVS knowledge base.
// This is a v1 placeholder for real retrieval (embeddings/vector search);
// it is intentionally simple and transparent about its limits.
import db from '../lib/dataStore.js';

export async function searchKnowledgeBase({ query, grade, subject, limit = 3 }) {
  const terms = (query || '')
    .toLowerCase()
    .split(/\W+/)
    .filter((t) => t.length > 2);
  if (terms.length === 0) return [];

  const entries = await db.list('knowledgeBase', (e) => {
    if (grade && e.grade && String(e.grade) !== String(grade)) return false;
    if (subject && e.subject && e.subject.toLowerCase() !== String(subject).toLowerCase()) return false;
    return true;
  });

  const scored = entries
    .map((e) => {
      const haystack = `${e.topic} ${e.content}`.toLowerCase();
      const score = terms.reduce((acc, t) => acc + (haystack.includes(t) ? 1 : 0), 0);
      return { ...e, score };
    })
    .filter((e) => e.score > 0)
    .sort((a, b) => b.score - a.score);

  return scored.slice(0, limit);
}
