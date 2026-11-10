import { useCallback, useEffect, useRef, useState } from 'react';

// Browser speech-to-text that appends to an editable transcript.
// The transcript can also be typed into directly.
export function useSpeechInput() {
  const [transcript, setTranscript] = useState('');
  const [isRecording, setIsRecording] = useState(false);
  const [error, setError] = useState(null);
  const recognitionRef = useRef(null);
  const finalRef = useRef('');

  const stop = useCallback(() => {
    if (recognitionRef.current) recognitionRef.current.stop();
    setIsRecording(false);
  }, []);

  // Stop the mic on unmount.
  useEffect(() => () => recognitionRef.current?.stop(), []);

  const start = useCallback(() => {
    setError(null);
    const SpeechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRecognition) {
      setError('Speech recognition isn’t supported in this browser. Use Chrome or Edge, or type your answer.');
      return;
    }

    const recognition = new SpeechRecognition();
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.lang = 'en-US';

    // Continue from whatever is already in the box.
    setTranscript((current) => {
      finalRef.current = current ? `${current.trim()} ` : '';
      return current;
    });

    recognition.onstart = () => setIsRecording(true);
    recognition.onresult = (event) => {
      let interim = '';
      for (let i = event.resultIndex; i < event.results.length; i += 1) {
        const piece = event.results[i][0].transcript;
        if (event.results[i].isFinal) finalRef.current += `${piece} `;
        else interim += piece;
      }
      setTranscript(`${finalRef.current}${interim}`.trimStart());
    };
    recognition.onerror = (event) => {
      console.error('Speech recognition error:', event.error);
      setError(`Microphone error: ${event.error}`);
      setIsRecording(false);
    };
    recognition.onend = () => setIsRecording(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, []);

  const toggle = useCallback(() => (isRecording ? stop() : start()), [isRecording, start, stop]);

  const clear = useCallback(() => {
    setTranscript('');
    finalRef.current = '';
  }, []);

  return { transcript, setTranscript, isRecording, error, setError, start, stop, toggle, clear };
}
