import { API_URL } from '../config';

// API calls for the Verified warm-up (backend: verified_router.py).
// Kept separate from api.js so the existing calls are untouched.

async function request(path, { timeoutMs = 60_000, ...options } = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, signal: AbortSignal.timeout(timeoutMs) });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error(`The server didn’t respond within ${timeoutMs / 1000} seconds. Try again.`, { cause: err });
    }
    throw new Error(`Couldn’t reach the server at ${API_URL}. Check that the backend is running.`, { cause: err });
  }
  if (!response.ok) {
    let detail = '';
    try {
      detail = (await response.json())?.detail;
    } catch {
      detail = '';
    }
    throw new Error(typeof detail === 'string' && detail ? detail : `The server returned an error (HTTP ${response.status}).`);
  }
  return response.json();
}

// → { dsa: [{ id, title, question, topic }], behavioral: [...], max_followups, unlock_threshold }
export function getVerifiedQuestions() {
  return request('/api/verified/questions', { cache: 'no-store' });
}

// → { threshold, topics: { [topic]: { best_score, attempts, unlocked } } }
// Topics missing from `topics` have no warm-up and are always open.
export function getVerifiedProgress(userId) {
  return request(`/api/verified/progress/${encodeURIComponent(userId)}`, { cache: 'no-store' });
}

// `transcript` is the whole answer so far (first answer + follow-up answers).
// → { grade, extraction, next: { type, prompt }, is_final, saved, unlock, timings_ms, ... }
export function assessVerified({ kind, questionId, transcript, followupsAsked, userId }) {
  return request('/api/verified/assess', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    timeoutMs: 120_000,
    body: JSON.stringify({
      kind,
      question_id: questionId,
      transcript,
      followups_asked: followupsAsked,
      user_id: userId,
    }),
  });
}
