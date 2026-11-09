import { useState, useEffect, useRef, useCallback } from 'react';
import { Editor, DiffEditor } from '@monaco-editor/react';

const DSA_TOPICS = [
  'Arrays',
  'Graphs',
  'Dynamic Programming',
  'Two Pointers',
  'Sliding Window',
  'Trees & BST',
  'Binary Search',
  'Hash Map',
  'Heap / Priority Queue',
];

const BEHAVIORAL_TOPICS = [
  'Leadership',
  'Conflict Resolution',
  'Time Management',
  'Adaptability',
  'Cross-Team Collaboration',
  'Handling Failure',
];

const DIFFICULTIES = ['Easy', 'Medium', 'Hard'];

const DEFAULT_STARTER_CODE = `# Write your Python solution here
def solve(nums):
    # Explain your approach while coding
    pass
`;

export default function Interview() {
  const [interviewType, setInterviewType] = useState('DSA');
  const [topic, setTopic] = useState(DSA_TOPICS[0]);
  const [difficulty, setDifficulty] = useState('Medium');
  const [isInterviewStarted, setIsInterviewStarted] = useState(false);
  const [generatedQuestion, setGeneratedQuestion] = useState('');
  const [dynamicSessionId, setDynamicSessionId] = useState('');
  const [isGenerating, setIsGenerating] = useState(false);

  const [code, setCode] = useState(DEFAULT_STARTER_CODE);
  const [optimalCodeSnippet, setOptimalCodeSnippet] = useState('');
  const [transcriptText, setTranscriptText] = useState('');
  const [messages, setMessages] = useState([]);
  const [wsStatus, setWsStatus] = useState('Disconnected');
  const [isRecording, setIsRecording] = useState(false);
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [evaluationResults, setEvaluationResults] = useState(null);
  const [errorMsg, setErrorMsg] = useState(null);

  const wsRef = useRef(null);
  const recognitionRef = useRef(null);
  const finalTranscriptRef = useRef('');
  const chatEndRef = useRef(null);

  const isBehavioral = interviewType === 'BEHAVIORAL';
  const activeTopics = isBehavioral ? BEHAVIORAL_TOPICS : DSA_TOPICS;

  const handleInterviewTypeChange = (newType) => {
    setInterviewType(newType);
    if (newType === 'BEHAVIORAL') {
      setTopic(BEHAVIORAL_TOPICS[0]);
    } else {
      setTopic(DSA_TOPICS[0]);
    }
  };

  // 1. Voice Selection Logic: Prioritize Edge 'Natural', 'Google UK English', or 'Google US English' voices
  const getPremiumVoice = useCallback(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return null;
    }
    const voices = window.speechSynthesis.getVoices();
    if (!voices || voices.length === 0) {
      return null;
    }

    const preferredVoice = voices.find(
      (v) =>
        v.name.includes('Natural') ||
        v.name.includes('Google UK English') ||
        v.name.includes('Google US English')
    );
    if (preferredVoice) {
      return preferredVoice;
    }

    const fallbackVoice = voices.find(
      (v) => v.lang === 'en-US' || v.lang === 'en-GB' || v.lang.startsWith('en-US') || v.lang.startsWith('en-GB')
    );
    return fallbackVoice || voices[0] || null;
  }, []);

  // 2. Load Voices Asynchronously on mount via onvoiceschanged
  useEffect(() => {
    if (typeof window === 'undefined' || !('speechSynthesis' in window)) {
      return undefined;
    }

    const handleVoicesChanged = () => {
      window.speechSynthesis.getVoices();
    };

    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;

    return () => {
      if (window.speechSynthesis.onvoiceschanged === handleVoicesChanged) {
        window.speechSynthesis.onvoiceschanged = null;
      }
    };
  }, []);

  // Connect WebSocket once dynamicSessionId is set and interview has started
  useEffect(() => {
    if (!isInterviewStarted || !dynamicSessionId) {
      return undefined;
    }

    if (wsRef.current) {
      wsRef.current.close();
    }

    setWsStatus('Connecting...');
    const ws = new WebSocket(
      `ws://127.0.0.1:8000/ws/interview/${dynamicSessionId}`
    );
    wsRef.current = ws;

    ws.onopen = () => {
      setWsStatus('Connected');
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        setIsFinalizing(false);

        if (data.error) {
          setMessages((prev) => [
            ...prev,
            {
              role: 'ai',
              error: data.error,
              timestamp: new Date().toLocaleTimeString(),
            },
          ]);
          return;
        }

        // 3. Update the TTS Execution inside WebSocket onmessage handler
        const spokenText = data.teacher_feedback || data.barge_in_prompt;
        if (
          spokenText &&
          typeof window !== 'undefined' &&
          'speechSynthesis' in window
        ) {
          try {
            window.speechSynthesis.cancel();
            const utterance = new SpeechSynthesisUtterance(spokenText);
            utterance.voice = getPremiumVoice();
            utterance.pitch = 1.1;
            utterance.rate = 0.95;
            window.speechSynthesis.speak(utterance);
          } catch (ttsErr) {
            console.error('TTS synthesis failed:', ttsErr);
          }
        }

        const returnedOptimalCode =
          data.optimal_code_snippet ||
          data.validation?.optimal_code_snippet ||
          data.raw_extraction?.optimal_code_snippet ||
          '';

        if (returnedOptimalCode) {
          setOptimalCodeSnippet(returnedOptimalCode);
        }

        // Check if Teacher Evaluation payload arrived
        if (
          data.optimal_solution_text ||
          data.teacher_feedback ||
          returnedOptimalCode ||
          data.validation?.optimal_solution_text ||
          data.validation?.teacher_feedback
        ) {
          setEvaluationResults({
            score: data.validation?.score,
            teacherFeedback:
              data.teacher_feedback ||
              data.validation?.teacher_feedback ||
              data.barge_in_prompt,
            optimalSolutionText:
              data.optimal_solution_text ||
              data.validation?.optimal_solution_text,
            optimalCodeSnippet: returnedOptimalCode,
            validation: data.validation,
            rubric: data.rubric,
          });
        }

        setMessages((prev) => [
          ...prev,
          {
            role:
              data.optimal_solution_text ||
              data.teacher_feedback ||
              returnedOptimalCode
                ? 'teacher'
                : 'ai',
            bargeInPrompt: data.teacher_feedback || data.barge_in_prompt,
            score: data.validation?.score,
            validation: data.validation,
            rawExtraction: data.raw_extraction,
            rubric: data.rubric,
            metrics: data.metrics,
            timestamp: new Date().toLocaleTimeString(),
          },
        ]);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
        setIsFinalizing(false);
      }
    };

    ws.onerror = () => {
      setWsStatus('Error');
    };

    ws.onclose = () => {
      setWsStatus('Disconnected');
    };

    return () => {
      ws.close();
    };
  }, [isInterviewStarted, dynamicSessionId, getPremiumVoice]);

  // Stop microphone and TTS on unmount
  useEffect(() => {
    return () => {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
        window.speechSynthesis.cancel();
      }
    };
  }, []);

  useEffect(() => {
    chatEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, evaluationResults]);

  const handleGenerateInterview = async () => {
    setIsGenerating(true);
    setErrorMsg(null);
    setMessages([]);
    setEvaluationResults(null);
    setOptimalCodeSnippet('');
    setCode(
      `# ${topic} (${difficulty}) Solution\ndef solve():\n    # Write your optimal ${topic} implementation here\n    pass\n`
    );
    setTranscriptText('');
    finalTranscriptRef.current = '';

    try {
      const response = await fetch('http://127.0.0.1:8000/generate_question', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          interview_type: interviewType,
          topic,
          difficulty: isBehavioral ? 'Behavioral' : difficulty,
        }),
      });

      if (!response.ok) {
        throw new Error(`HTTP error! Status: ${response.status}`);
      }

      const data = await response.json();
      setGeneratedQuestion(data.generated_question);
      setDynamicSessionId(data.session_id);
      setIsInterviewStarted(true);
    } catch (err) {
      console.error('Failed to generate interview question:', err);
      setErrorMsg(
        err.message || 'Failed to generate question from backend server.'
      );
    } finally {
      setIsGenerating(false);
    }
  };

  const handleResetInterview = () => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }
    if (wsRef.current) {
      wsRef.current.close();
    }
    if (typeof window !== 'undefined' && 'speechSynthesis' in window) {
      window.speechSynthesis.cancel();
    }
    setIsInterviewStarted(false);
    setGeneratedQuestion('');
    setDynamicSessionId('');
    setMessages([]);
    setEvaluationResults(null);
    setOptimalCodeSnippet('');
    setCode(DEFAULT_STARTER_CODE);
    setTranscriptText('');
    finalTranscriptRef.current = '';
    setErrorMsg(null);
  };

  const handleToggleMicrophone = () => {
    setErrorMsg(null);

    if (isRecording) {
      if (recognitionRef.current) {
        recognitionRef.current.stop();
      }
      setIsRecording(false);
      return;
    }

    const SpeechRecognition =
      window.SpeechRecognition || window.webkitSpeechRecognition;

    if (!SpeechRecognition) {
      setErrorMsg(
        'SpeechRecognition API is not supported in this browser. Please use Chrome or Edge.'
      );
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    finalTranscriptRef.current = transcriptText
      ? `${transcriptText.trim()} `
      : '';

    recognition.onstart = () => {
      setIsRecording(true);
    };

    recognition.onresult = (event) => {
      let interimTranscript = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) {
          finalTranscriptRef.current += `${piece} `;
        } else {
          interimTranscript += piece;
        }
      }
      setTranscriptText(
        `${finalTranscriptRef.current}${interimTranscript}`.trimStart()
      );
    };

    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setErrorMsg(`Microphone error: ${event.error}`);
      setIsRecording(false);
    };

    recognition.onend = () => {
      setIsRecording(false);
    };

    recognitionRef.current = recognition;
    recognition.start();
  };

  const handleSendAnswer = () => {
    const trimmed = transcriptText.trim();
    if (!trimmed && (isBehavioral || !code.trim())) return;

    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setErrorMsg(
        `WebSocket is not connected to ws://127.0.0.1:8000/ws/interview/${dynamicSessionId}`
      );
      return;
    }

    const payload = {
      interview_type: interviewType,
      topic,
      transcript: trimmed,
      code: isBehavioral ? '' : code,
    };

    wsRef.current.send(JSON.stringify(payload));

    setMessages((prev) => [
      ...prev,
      {
        role: 'user',
        topic,
        transcript: trimmed || '[Submitted updated code for review]',
        timestamp: new Date().toLocaleTimeString(),
      },
    ]);

    setTranscriptText('');
    finalTranscriptRef.current = '';
  };

  const handleFinalizeAndEvaluate = () => {
    if (isRecording && recognitionRef.current) {
      recognitionRef.current.stop();
      setIsRecording(false);
    }

    if (!wsRef.current || wsRef.current.readyState !== WebSocket.OPEN) {
      setErrorMsg('WebSocket is not connected.');
      return;
    }

    const trimmed = transcriptText.trim();
    if (trimmed) {
      setMessages((prev) => [
        ...prev,
        {
          role: 'user',
          topic,
          transcript: trimmed,
          timestamp: new Date().toLocaleTimeString(),
        },
      ]);
    }

    setIsFinalizing(true);
    wsRef.current.send(
      JSON.stringify({
        action: 'evaluate_final',
        interview_type: interviewType,
        transcript: transcriptText,
        code: isBehavioral ? '' : code,
      })
    );

    setTranscriptText('');
    finalTranscriptRef.current = '';
  };

  return (
    <div className="max-w-7xl mx-auto bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden">
      {/* Header */}
      <div className="p-6 bg-gray-900 text-white flex flex-col sm:flex-row sm:items-center justify-between gap-3">
        <div>
          <h2 className="text-lg font-bold">
            Dynamic Multi-Turn AI Interview{' '}
            {isBehavioral ? '(Behavioral STAR)' : '& Live Code Studio'}
          </h2>
          <p className="text-xs text-gray-400">
            {isInterviewStarted
              ? `Session ID: ${dynamicSessionId} • ${interviewType} • ${topic}${
                  isBehavioral ? '' : ` (${difficulty})`
                }`
              : 'Configure your interview type, topic, and difficulty below'}
          </p>
        </div>

        <div className="flex items-center gap-3">
          {isRecording && (
            <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-red-900/60 border border-red-500 text-red-200 text-xs font-semibold">
              <span className="relative flex h-2.5 w-2.5">
                <span className="animate-ping absolute inline-flex h-full w-full rounded-full bg-red-400 opacity-75" />
                <span className="relative inline-flex rounded-full h-2.5 w-2.5 bg-red-500" />
              </span>
              <span>Recording...</span>
            </div>
          )}

          {isInterviewStarted && (
            <>
              <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-gray-800 text-xs font-medium">
                <span
                  className={`h-2.5 w-2.5 rounded-full ${
                    wsStatus === 'Connected'
                      ? 'bg-green-400'
                      : wsStatus === 'Connecting...'
                      ? 'bg-yellow-400'
                      : 'bg-red-500'
                  }`}
                />
                <span>{wsStatus}</span>
              </div>

              <button
                type="button"
                onClick={handleResetInterview}
                className="px-3 py-1.5 rounded-lg bg-gray-800 hover:bg-gray-700 text-xs font-semibold text-gray-200 border border-gray-700 transition cursor-pointer"
              >
                New Interview
              </button>
            </>
          )}
        </div>
      </div>

      {/* Setup UI (Before Interview Starts) */}
      {!isInterviewStarted ? (
        <div className="p-8 bg-gray-100 space-y-6">
          <div className="max-w-2xl mx-auto bg-white p-6 rounded-lg shadow-md border border-gray-200 space-y-6">
            <div>
              <h3 className="text-base font-bold text-gray-900">
                Interview Setup
              </h3>
              <p className="text-sm text-gray-500">
                Choose between a Technical DSA Coding Interview or a Behavioral
                STAR Interview, then select your focus topic.
              </p>
            </div>

            {/* Interview Type Radio / Toggle: [ DSA | Behavioral ] */}
            <div>
              <span className="block text-sm font-semibold text-gray-700 mb-2">
                Interview Type
              </span>
              <div className="grid grid-cols-2 gap-3 p-1 bg-gray-100 rounded-lg border border-gray-200">
                <label
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-semibold cursor-pointer transition ${
                    interviewType === 'DSA'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="interviewType"
                    value="DSA"
                    checked={interviewType === 'DSA'}
                    onChange={() => handleInterviewTypeChange('DSA')}
                    className="sr-only"
                  />
                  <span>DSA (Coding &amp; Complexity)</span>
                </label>

                <label
                  className={`flex items-center justify-center gap-2 py-2.5 px-4 rounded-md text-sm font-semibold cursor-pointer transition ${
                    interviewType === 'BEHAVIORAL'
                      ? 'bg-blue-600 text-white shadow-sm'
                      : 'text-gray-700 hover:bg-gray-200'
                  }`}
                >
                  <input
                    type="radio"
                    name="interviewType"
                    value="BEHAVIORAL"
                    checked={interviewType === 'BEHAVIORAL'}
                    onChange={() => handleInterviewTypeChange('BEHAVIORAL')}
                    className="sr-only"
                  />
                  <span>Behavioral (STAR Method)</span>
                </label>
              </div>
            </div>

            <div
              className={`grid grid-cols-1 ${
                isBehavioral ? '' : 'sm:grid-cols-2'
              } gap-4`}
            >
              <div>
                <label
                  htmlFor="topic-select"
                  className="block text-sm font-semibold text-gray-700 mb-1.5"
                >
                  {isBehavioral ? 'Behavioral Soft-Skill Topic' : 'DSA Topic'}
                </label>
                <select
                  id="topic-select"
                  value={topic}
                  onChange={(e) => setTopic(e.target.value)}
                  className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                >
                  {activeTopics.map((t) => (
                    <option key={t} value={t}>
                      {t}
                    </option>
                  ))}
                </select>
              </div>

              {!isBehavioral && (
                <div>
                  <label
                    htmlFor="difficulty-select"
                    className="block text-sm font-semibold text-gray-700 mb-1.5"
                  >
                    Difficulty
                  </label>
                  <select
                    id="difficulty-select"
                    value={difficulty}
                    onChange={(e) => setDifficulty(e.target.value)}
                    className="w-full rounded-lg border border-gray-300 bg-white px-3.5 py-2.5 text-sm font-medium text-gray-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  >
                    {DIFFICULTIES.map((d) => (
                      <option key={d} value={d}>
                        {d}
                      </option>
                    ))}
                  </select>
                </div>
              )}
            </div>

            {errorMsg && (
              <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-xs text-red-700 font-medium">
                {errorMsg}
              </div>
            )}

            <div className="flex justify-end">
              <button
                type="button"
                onClick={handleGenerateInterview}
                disabled={isGenerating}
                className="inline-flex items-center px-6 py-2.5 rounded-lg bg-blue-600 text-white text-sm font-semibold shadow-md hover:bg-blue-700 disabled:opacity-60 focus:outline-none focus:ring-2 focus:ring-blue-600 transition cursor-pointer"
              >
                {isGenerating ? 'Generating Question...' : 'Generate Interview'}
              </button>
            </div>
          </div>
        </div>
      ) : (
        <div className="p-6 bg-gray-100 space-y-6">
          {/* Generated Question Card */}
          <div
            className={`${
              isBehavioral ? 'max-w-3xl mx-auto' : ''
            } bg-blue-50 border border-blue-200 rounded-lg p-4 shadow-sm`}
          >
            <div className="flex items-center justify-between mb-1.5">
              <span className="text-xs font-bold uppercase tracking-wider text-blue-600">
                Generated {isBehavioral ? 'Behavioral' : 'DSA'} Question &bull;{' '}
                {topic}
              </span>
              <span className="px-2.5 py-0.5 rounded-full text-xs font-bold bg-blue-100 text-blue-800">
                {isBehavioral ? 'STAR Rubric (S • T • A • R)' : difficulty}
              </span>
            </div>
            <p className="text-sm sm:text-base font-medium text-gray-900 whitespace-pre-line leading-relaxed">
              {generatedQuestion}
            </p>
          </div>

          {/* Conditional Layout: Full Centered Width for BEHAVIORAL, Side-by-Side 2-Column Grid for DSA */}
          <div
            className={
              isBehavioral
                ? 'max-w-3xl mx-auto w-full'
                : 'grid grid-cols-1 lg:grid-cols-2 gap-6 items-start'
            }
          >
            {/* Chat Window + Transcript Controls */}
            <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col">
              <div className="px-4 py-3 bg-gray-800 text-white flex items-center justify-between">
                <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
                  Live {isBehavioral ? 'Behavioral STAR' : 'Technical'}{' '}
                  Conversation
                </span>
                <span className="text-xs text-gray-400">
                  {messages.length} {messages.length === 1 ? 'turn' : 'turns'}
                </span>
              </div>

              {/* Scrolling Multi-Turn Chat Window */}
              <div className="p-4 h-80 overflow-y-auto space-y-4 bg-white">
                {messages.map((msg, idx) =>
                  msg.role === 'user' ? (
                    <div key={idx} className="flex justify-end">
                      <div className="max-w-lg rounded-lg bg-blue-600 text-white p-3.5 shadow-md">
                        <div className="flex items-center justify-between gap-4 mb-1">
                          <span className="text-xs font-semibold uppercase tracking-wider text-blue-100">
                            Candidate &bull; {msg.topic}
                          </span>
                          <span className="text-xs text-blue-200">
                            {msg.timestamp}
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">
                          {msg.transcript}
                        </p>
                      </div>
                    </div>
                  ) : (
                    <div key={idx} className="flex justify-start">
                      <div
                        className={`max-w-lg w-full rounded-lg p-3.5 border shadow-md ${
                          msg.role === 'teacher'
                            ? 'bg-green-50 border-green-200 text-green-800'
                            : 'bg-gray-100 border-gray-200 text-gray-800'
                        }`}
                      >
                        <div className="flex items-center justify-between gap-4 mb-2">
                          <span
                            className={`text-xs font-bold uppercase tracking-wider ${
                              msg.role === 'teacher'
                                ? 'text-green-800'
                                : 'text-blue-600'
                            }`}
                          >
                            {msg.role === 'teacher'
                              ? 'AI Teacher (Final Evaluation)'
                              : 'AI Interviewer (TTS Enabled)'}
                          </span>
                          <span className="text-xs text-gray-400">
                            {msg.timestamp}
                          </span>
                        </div>

                        {msg.error ? (
                          <p className="text-sm text-red-600 font-medium">
                            {msg.error}
                          </p>
                        ) : (
                          <div className="space-y-2.5">
                            <p className="text-sm font-semibold text-gray-900 leading-relaxed">
                              {msg.bargeInPrompt}
                            </p>

                            <div className="flex flex-wrap items-center gap-2 pt-1">
                              <span className="inline-flex items-center px-2.5 py-1 rounded-full text-xs font-bold bg-blue-100 text-blue-600">
                                Validation Score:{' '}
                                {typeof msg.score === 'number'
                                  ? `${(msg.score * 100).toFixed(0)}% (${msg.score.toFixed(2)})`
                                  : 'N/A'}
                              </span>

                              {msg.validation &&
                              ('S' in msg.validation || isBehavioral) ? (
                                <div className="text-xs text-gray-600 bg-white px-2.5 py-1 rounded-lg border border-gray-200 flex items-center gap-1.5">
                                  <span className="font-semibold">STAR:</span>
                                  {['S', 'T', 'A', 'R'].map((comp) => (
                                    <span
                                      key={comp}
                                      className={`px-1.5 py-0.5 rounded font-bold ${
                                        msg.validation[comp]
                                          ? 'bg-green-100 text-green-700'
                                          : 'bg-red-100 text-red-700'
                                      }`}
                                    >
                                      {comp}:{' '}
                                      {msg.validation[comp] ? '✓' : '✗'}
                                    </span>
                                  ))}
                                </div>
                              ) : (
                                msg.rawExtraction && (
                                  <div className="text-xs text-gray-600 bg-white px-2.5 py-1 rounded-lg border border-gray-200">
                                    Paradigm:{' '}
                                    <strong className="text-gray-900">
                                      {msg.rawExtraction.algorithmic_paradigm}
                                    </strong>{' '}
                                    | Time:{' '}
                                    <strong className="text-gray-900">
                                      {msg.rawExtraction.time_complexity}
                                    </strong>{' '}
                                    | Space:{' '}
                                    <strong className="text-gray-900">
                                      {msg.rawExtraction.space_complexity}
                                    </strong>
                                  </div>
                                )
                              )}
                            </div>
                          </div>
                        )}
                      </div>
                    </div>
                  )
                )}
                <div ref={chatEndRef} />
              </div>

              {/* Transcript Input & Action Buttons */}
              <div className="p-4 border-t border-gray-200 bg-gray-50 space-y-3">
                <div>
                  <div className="flex items-center justify-between mb-1">
                    <label
                      htmlFor="transcript-input"
                      className="block text-xs font-bold uppercase tracking-wider text-gray-700"
                    >
                      {isBehavioral
                        ? 'Your STAR Response (Situation, Task, Action, Result)'
                        : 'Spoken / Typed Explanation'}
                    </label>
                    {isRecording && (
                      <span className="inline-flex items-center gap-1.5 text-xs font-semibold text-red-600">
                        <span className="h-2 w-2 rounded-full bg-red-600 animate-pulse" />
                        Recording...
                      </span>
                    )}
                  </div>
                  <textarea
                    id="transcript-input"
                    rows={3}
                    value={transcriptText}
                    onChange={(e) => setTranscriptText(e.target.value)}
                    placeholder={
                      isBehavioral
                        ? 'Describe the Situation, Task, Action you took, and the measurable Result...'
                        : 'Explain your approach, algorithmic paradigm, time complexity, and space complexity while coding...'
                    }
                    className="w-full rounded-lg border border-gray-300 bg-white p-3 text-sm text-gray-900 shadow-sm focus:border-blue-600 focus:outline-none focus:ring-2 focus:ring-blue-600"
                  />
                  {errorMsg && (
                    <p className="mt-1 text-xs text-red-600 font-medium">
                      {errorMsg}
                    </p>
                  )}
                </div>

                <div className="flex flex-wrap items-center justify-between gap-2">
                  <button
                    type="button"
                    onClick={handleToggleMicrophone}
                    className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-lg text-xs font-semibold shadow-sm transition cursor-pointer ${
                      isRecording
                        ? 'bg-red-600 text-white hover:bg-red-700'
                        : 'bg-white text-gray-800 border border-gray-300 hover:bg-gray-100'
                    }`}
                  >
                    <span
                      className={`h-2 w-2 rounded-full ${
                        isRecording ? 'bg-white animate-ping' : 'bg-red-500'
                      }`}
                    />
                    {isRecording ? 'Stop Microphone' : 'Start Microphone'}
                  </button>

                  <div className="flex flex-wrap items-center gap-2">
                    <button
                      type="button"
                      onClick={handleSendAnswer}
                      className="inline-flex items-center px-4 py-2 rounded-lg bg-blue-600 text-white text-xs font-semibold shadow-md hover:bg-blue-700 transition cursor-pointer"
                    >
                      Send Answer
                    </button>

                    <button
                      type="button"
                      onClick={handleFinalizeAndEvaluate}
                      disabled={isFinalizing}
                      className="inline-flex items-center px-4 py-2 rounded-lg bg-green-600 text-white text-xs font-semibold shadow-md hover:bg-green-700 disabled:opacity-60 transition cursor-pointer"
                    >
                      {isFinalizing ? 'Evaluating...' : 'Finalize & Evaluate'}
                    </button>
                  </div>
                </div>
              </div>
            </div>

            {/* RIGHT COLUMN: Monaco Code Editor OR Teacher DiffEditor (Hidden for Behavioral Sessions) */}
            {!isBehavioral && (
              <div className="bg-white rounded-lg shadow-md border border-gray-200 overflow-hidden flex flex-col">
                <div className="px-4 py-3 bg-gray-800 text-white flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <span className="text-xs font-bold uppercase tracking-wider text-gray-200">
                      {optimalCodeSnippet
                        ? 'Teacher Code Diff View (Your Code vs. Optimal Solution)'
                        : 'Live Code Editor (Python)'}
                    </span>
                  </div>
                  {optimalCodeSnippet && (
                    <button
                      type="button"
                      onClick={() => setOptimalCodeSnippet('')}
                      className="text-xs text-blue-300 hover:text-white underline cursor-pointer"
                    >
                      Back to Live Editor
                    </button>
                  )}
                </div>

                <div className="h-[480px] w-full bg-[#1e1e1e]">
                  {optimalCodeSnippet ? (
                    <DiffEditor
                      height="100%"
                      language="python"
                      theme="vs-dark"
                      original={code}
                      modified={optimalCodeSnippet}
                      options={{
                        readOnly: true,
                        renderSideBySide: true,
                        minimap: { enabled: false },
                        fontSize: 13,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                      }}
                    />
                  ) : (
                    <Editor
                      height="100%"
                      language="python"
                      theme="vs-dark"
                      value={code}
                      onChange={(val) => setCode(val ?? '')}
                      options={{
                        minimap: { enabled: false },
                        fontSize: 14,
                        scrollBeyondLastLine: false,
                        automaticLayout: true,
                        tabSize: 4,
                      }}
                    />
                  )}
                </div>
              </div>
            )}
          </div>

          {/* Dedicated Evaluation Results Section (Teacher Response) */}
          {evaluationResults && (
            <div
              className={`${
                isBehavioral ? 'max-w-3xl mx-auto' : ''
              } p-6 rounded-lg bg-green-50 border border-green-200 text-green-800 shadow-md space-y-4`}
            >
              <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-green-200 pb-3">
                <div>
                  <h3 className="text-base font-bold text-green-900">
                    Evaluation Results (Teacher Mode)
                  </h3>
                  <p className="text-xs text-green-700">
                    Saved to your Performance Dashboard for topic:{' '}
                    <strong>{topic}</strong>
                  </p>
                </div>
                <span className="inline-flex items-center px-3.5 py-1.5 rounded-full text-sm font-bold bg-green-200 text-green-900">
                  Final Score:{' '}
                  {typeof evaluationResults.score === 'number'
                    ? `${(evaluationResults.score * 100).toFixed(0)}% (${evaluationResults.score.toFixed(2)})`
                    : 'N/A'}
                </span>
              </div>

              {isBehavioral && evaluationResults.validation && (
                <div className="flex flex-wrap items-center gap-2">
                  <span className="text-xs font-bold uppercase tracking-wider text-green-800">
                    STAR Component Checklist:
                  </span>
                  {[
                    { key: 'S', label: 'Situation' },
                    { key: 'T', label: 'Task' },
                    { key: 'A', label: 'Action' },
                    { key: 'R', label: 'Result' },
                  ].map(({ key, label }) => (
                    <span
                      key={key}
                      className={`px-2.5 py-1 rounded-full text-xs font-bold ${
                        evaluationResults.validation[key]
                          ? 'bg-green-200 text-green-900'
                          : 'bg-red-100 text-red-800'
                      }`}
                    >
                      {label} ({key}):{' '}
                      {evaluationResults.validation[key] ? '✓ Covered' : '✗ Missing'}
                    </span>
                  ))}
                </div>
              )}

              {evaluationResults.teacherFeedback && (
                <div>
                  <h4 className="text-xs font-bold uppercase tracking-wider text-green-700 mb-1">
                    Teacher Feedback
                  </h4>
                  <p className="text-sm text-green-900 leading-relaxed">
                    {evaluationResults.teacherFeedback}
                  </p>
                </div>
              )}

              {evaluationResults.optimalSolutionText && (
                <div className="bg-white p-4 rounded-lg border border-green-200 text-gray-800">
                  <h4 className="text-xs font-bold uppercase tracking-wider text-green-700 mb-1">
                    {isBehavioral
                      ? 'Reference Model STAR Answer'
                      : 'Optimal Solution & Complexity Breakdown'}
                  </h4>
                  {!isBehavioral && evaluationResults.rubric && (
                    <div className="flex flex-wrap gap-3 text-xs text-gray-600 mb-2 pb-2 border-b border-gray-100">
                      <span>
                        Optimal Paradigm:{' '}
                        <strong className="text-gray-900">
                          {evaluationResults.rubric.algorithmic_paradigm}
                        </strong>
                      </span>
                      <span>
                        Optimal Time:{' '}
                        <strong className="text-gray-900">
                          {evaluationResults.rubric.time_complexity}
                        </strong>
                      </span>
                      <span>
                        Optimal Space:{' '}
                        <strong className="text-gray-900">
                          {evaluationResults.rubric.space_complexity}
                        </strong>
                      </span>
                    </div>
                  )}
                  <p className="text-sm text-gray-800 whitespace-pre-line leading-relaxed">
                    {evaluationResults.optimalSolutionText}
                  </p>
                </div>
              )}
            </div>
          )}
        </div>
      )}
    </div>
  );
}
