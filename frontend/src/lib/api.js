import { API_URL } from '../config';

// Question generation calls an LLM, so allow plenty of time before giving up.
const TIMEOUT_MS = 60_000;

async function request(path, options = {}) {
  let response;
  try {
    response = await fetch(`${API_URL}${path}`, { ...options, signal: AbortSignal.timeout(TIMEOUT_MS) });
  } catch (err) {
    if (err.name === 'TimeoutError') {
      throw new Error(
        `The server at ${API_URL} didn’t respond within ${TIMEOUT_MS / 1000} seconds. It may be busy or stuck; try again.`,
        { cause: err },
      );
    }
    throw new Error(`Couldn’t reach the server at ${API_URL}. Check that the backend is running.`, { cause: err });
  }
  if (!response.ok) throw new Error(`The server returned an error (HTTP ${response.status}).`);
  return response.json();
}

// POST /generate_question → { generated_question, session_id }
export function generateQuestion({ interviewType, topic, difficulty }) {
  return request('/generate_question', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      interview_type: interviewType,
      topic,
      difficulty: interviewType === 'BEHAVIORAL' ? 'Behavioral' : difficulty,
    }),
  });
}

// GET /api/dashboard/{userId} → { user_id, average_accuracy, weakest_skill, top_priority_skill, recommendations }
export async function getDashboardData(userId) {
  return request(`/api/dashboard/${encodeURIComponent(userId)}`, {
    cache: 'no-store',
  });
}

// GET /recommendations/{userId} → { recommendations: [{ skill, accuracy, weak_area, priority, action }] }
export async function getRecommendations(userId) {
  const data = await getDashboardData(userId);
  return data.recommendations || [];
}
