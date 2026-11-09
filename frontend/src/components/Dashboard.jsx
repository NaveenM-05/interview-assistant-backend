import { useState, useEffect, useCallback } from 'react';

export default function Dashboard() {
  const [recommendations, setRecommendations] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const fetchRecommendations = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const response = await fetch(
        'http://127.0.0.1:8000/recommendations/test_user_123'
      );
      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }
      const data = await response.json();
      setRecommendations(data.recommendations || []);
    } catch (err) {
      setError(err.message || 'Failed to fetch recommendations');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchRecommendations();
  }, [fetchRecommendations]);

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4 bg-white p-6 rounded-lg shadow-md border border-gray-200">
        <div>
          <h2 className="text-xl font-bold text-gray-900">
            Personalized Feedback Dashboard
          </h2>
          <p className="text-sm text-gray-500">
            Skill recommendations and weakness analysis for user{' '}
            <code className="font-mono font-semibold text-blue-600">test_user_123</code>
          </p>
        </div>
        <button
          type="button"
          onClick={fetchRecommendations}
          className="inline-flex items-center justify-center px-4 py-2 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-md hover:bg-blue-700 transition cursor-pointer"
        >
          Refresh Recommendations
        </button>
      </div>

      {loading ? (
        <div className="p-6 text-center bg-white rounded-lg shadow-md border border-gray-200 text-gray-500">
          Loading recommendations...
        </div>
      ) : error ? (
        <div className="p-6 bg-red-50 border border-red-200 rounded-lg shadow-md text-red-700 text-sm">
          <strong>Error loading recommendations:</strong> {error}
        </div>
      ) : recommendations.length === 0 ? (
        <div className="p-6 text-center bg-white rounded-lg shadow-md border border-gray-200 text-gray-500">
          No performance records found yet for <code className="text-blue-600 font-semibold">test_user_123</code>. Submit an answer in the{' '}
          <strong className="text-gray-800">Mock Interview</strong> tab first!
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
          {recommendations.map((rec, index) => (
            <div
              key={rec.skill || index}
              className="bg-white rounded-lg shadow-md border border-gray-200 p-6 flex flex-col justify-between hover:shadow-lg transition"
            >
              <div className="space-y-4">
                <div className="flex items-start justify-between gap-2">
                  <h3 className="text-lg font-bold text-blue-600">
                    {rec.skill}
                  </h3>
                  <span
                    className={`px-3 py-1 rounded-full text-xs font-bold ${
                      rec.accuracy >= 80
                        ? 'bg-green-100 text-green-800'
                        : rec.accuracy >= 50
                        ? 'bg-yellow-100 text-yellow-800'
                        : 'bg-red-100 text-red-800'
                    }`}
                  >
                    {rec.accuracy}% Accuracy
                  </span>
                </div>

                <div className="text-sm space-y-2 bg-gray-100 p-3 rounded-lg">
                  <div className="flex justify-between py-1 border-b border-gray-200">
                    <span className="text-gray-500 font-medium">Weak Area</span>
                    <span className="font-semibold text-gray-900">
                      {rec.weak_area}
                    </span>
                  </div>
                  {rec.priority !== undefined && (
                    <div className="flex justify-between py-1">
                      <span className="text-gray-500 font-medium">Priority Score</span>
                      <span className="font-mono font-semibold text-gray-800">
                        {rec.priority}
                      </span>
                    </div>
                  )}
                </div>
              </div>

              <div className="mt-5 pt-4 border-t border-gray-200">
                <span className="block text-xs font-bold uppercase tracking-wider text-blue-600 mb-1">
                  Suggested Action
                </span>
                <p className="text-sm text-gray-700 leading-relaxed">
                  {rec.action}
                </p>
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
