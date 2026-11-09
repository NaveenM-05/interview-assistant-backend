import { useState } from 'react';
import Interview from './components/Interview';
import Dashboard from './components/Dashboard';

export default function App() {
  const [activeTab, setActiveTab] = useState('interview');

  return (
    <div className="min-h-screen bg-gray-100 text-gray-900">
      {/* Top Navigation Bar */}
      <header className="bg-white border-b border-gray-200 shadow-sm sticky top-0 z-10">
        <div className="max-w-7xl mx-auto px-6 py-4 flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-blue-600">
              AI Interview Assistant
            </h1>
            <p className="text-xs text-gray-500">
              Real-Time DSA Evaluation, Live Code Analysis &amp; Adaptive Recommendation Engine
            </p>
          </div>

          <nav className="inline-flex rounded-lg bg-gray-100 p-1 border border-gray-200">
            <button
              type="button"
              onClick={() => setActiveTab('interview')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                activeTab === 'interview'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Mock Interview
            </button>
            <button
              type="button"
              onClick={() => setActiveTab('dashboard')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold transition cursor-pointer ${
                activeTab === 'dashboard'
                  ? 'bg-white text-blue-600 shadow-md'
                  : 'text-gray-600 hover:text-gray-900'
              }`}
            >
              Feedback Dashboard
            </button>
          </nav>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto p-6">
        {activeTab === 'interview' ? <Interview /> : <Dashboard />}
      </main>
    </div>
  );
}
