import { useCallback, useEffect, useRef, useState } from 'react';
import { WS_URL } from '../config';

const now = () => new Date().toLocaleTimeString();

// Turns one WebSocket payload from the backend into UI state. The shape mirrors
// what main.py sends: barge-in prompts mid-answer, and a teacher evaluation
// (score, feedback, optimal solution/code, rubric) after `evaluate_final`.
function parsePayload(data) {
  const optimalCode =
    data.optimal_code_snippet ||
    data.validation?.optimal_code_snippet ||
    data.raw_extraction?.optimal_code_snippet ||
    '';

  const isTeacher = Boolean(data.optimal_solution_text || data.teacher_feedback || optimalCode);
  const isEvaluation =
    isTeacher || Boolean(data.validation?.optimal_solution_text || data.validation?.teacher_feedback);

  const evaluation = isEvaluation
    ? {
        score: data.validation?.score,
        teacherFeedback: data.teacher_feedback || data.validation?.teacher_feedback || data.barge_in_prompt,
        optimalSolutionText: data.optimal_solution_text || data.validation?.optimal_solution_text,
        optimalCodeSnippet: optimalCode,
        validation: data.validation,
        rubric: data.rubric,
      }
    : null;

  const message = {
    role: isTeacher ? 'teacher' : 'ai',
    bargeInPrompt: data.teacher_feedback || data.barge_in_prompt,
    score: data.validation?.score,
    validation: data.validation,
    rawExtraction: data.raw_extraction,
    rubric: data.rubric,
    metrics: data.metrics,
    timestamp: now(),
  };

  return { optimalCode, evaluation, message, spokenText: data.teacher_feedback || data.barge_in_prompt };
}

/**
 * Live interview connection to ws://…/ws/interview/{sessionId}.
 * `onSpeak` is called with any interviewer text that should be read aloud.
 */
export function useInterviewSocket(sessionId, { onSpeak } = {}) {
  // The room remounts per session (keyed by sessionId), so start as connecting.
  const [status, setStatus] = useState(sessionId ? 'Connecting' : 'Disconnected');
  const [messages, setMessages] = useState([]);
  const [evaluation, setEvaluation] = useState(null);
  const [optimalCode, setOptimalCode] = useState('');
  const [isFinalizing, setIsFinalizing] = useState(false);
  const [isAwaitingReply, setIsAwaitingReply] = useState(false);
  const wsRef = useRef(null);
  const speakRef = useRef(onSpeak);
  const isFinalizingRef = useRef(false);

  useEffect(() => {
    speakRef.current = onSpeak;
  }, [onSpeak]);

  useEffect(() => {
    if (!sessionId) return undefined;

    // Close any prior ghost socket before opening a new one (e.g. on HMR / remount)
    if (wsRef.current) {
      wsRef.current.onopen = null;
      wsRef.current.onerror = null;
      wsRef.current.onclose = null;
      wsRef.current.onmessage = null;
      wsRef.current.close();
      wsRef.current = null;
    }

    const ws = new WebSocket(`${WS_URL}/ws/interview/${sessionId}`);
    wsRef.current = ws;

    ws.onopen = () => setStatus('Connected');
    ws.onerror = () => setStatus('Error');
    ws.onclose = () => {
      setStatus('Disconnected');
      setIsAwaitingReply(false);
      setIsFinalizing(false);
      isFinalizingRef.current = false;
    };
    ws.onmessage = (event) => {
      let data;
      try {
        data = JSON.parse(event.data);
      } catch (err) {
        console.error('Failed to parse WebSocket message:', err);
        setIsFinalizing(false);
        setIsAwaitingReply(false);
        isFinalizingRef.current = false;
        return;
      }

      // Handle real-time streaming text chunks
      if (data.type === 'chunk') {
        const chunkText = data.text || '';
        if (!chunkText) return;
        setIsAwaitingReply(false);
        setMessages((prev) => {
          const last = prev[prev.length - 1];
          if (last && last.isStreaming) {
            return [
              ...prev.slice(0, -1),
              {
                ...last,
                bargeInPrompt: `${last.bargeInPrompt || ''}${chunkText}`,
              },
            ];
          }
          return [
            ...prev,
            {
              role: isFinalizingRef.current ? 'teacher' : 'ai',
              bargeInPrompt: chunkText,
              isStreaming: true,
              timestamp: now(),
            },
          ];
        });
        return;
      }

      setIsFinalizing(false);
      setIsAwaitingReply(false);
      isFinalizingRef.current = false;

      if (data.error) {
        setMessages((prev) => {
          const base = prev[prev.length - 1]?.isStreaming ? prev.slice(0, -1) : prev;
          return [...base, { role: 'ai', error: data.error, timestamp: now() }];
        });
        return;
      }

      const parsed = parsePayload(data);
      if (parsed.spokenText) speakRef.current?.(parsed.spokenText);
      if (parsed.optimalCode) setOptimalCode(parsed.optimalCode);
      if (parsed.evaluation) setEvaluation(parsed.evaluation);
      setMessages((prev) => {
        const last = prev[prev.length - 1];
        if (last && last.isStreaming) {
          return [
            ...prev.slice(0, -1),
            {
              ...parsed.message,
              bargeInPrompt: parsed.message.bargeInPrompt || last.bargeInPrompt,
              isStreaming: false,
            },
          ];
        }
        return [...prev, parsed.message];
      });
    };

    return () => {
      ws.onopen = null;
      ws.onerror = null;
      ws.onclose = null;
      ws.onmessage = null;
      ws.close();
      if (wsRef.current === ws) {
        wsRef.current = null;
      }
    };
  }, [sessionId]);

  const isOpen = () => wsRef.current?.readyState === WebSocket.OPEN;

  // Returns an error string, or null on success.
  const send = useCallback((payload) => {
    if (!isOpen()) return `Not connected to ${WS_URL}/ws/interview/${sessionId}. Is the backend running?`;
    wsRef.current.send(JSON.stringify(payload));
    if (payload.action !== 'evaluate_final') setIsAwaitingReply(true);
    return null;
  }, [sessionId]);

  const addUserMessage = useCallback((transcript, topic) => {
    setMessages((prev) => [...prev, { role: 'user', topic, transcript, timestamp: now() }]);
  }, []);

  const finalize = useCallback(
    (payload) => {
      isFinalizingRef.current = true;
      const err = send({ action: 'evaluate_final', ...payload });
      if (!err) {
        setIsFinalizing(true);
      } else {
        isFinalizingRef.current = false;
      }
      return err;
    },
    [send],
  );

  const close = useCallback(() => wsRef.current?.close(), []);

  return {
    status,
    messages,
    evaluation,
    optimalCode,
    clearOptimalCode: () => setOptimalCode(''),
    isFinalizing,
    isAwaitingReply,
    send,
    finalize,
    addUserMessage,
    close,
  };
}
