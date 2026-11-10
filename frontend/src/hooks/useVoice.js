import { useCallback, useEffect } from 'react';

const hasSynthesis = () => typeof window !== 'undefined' && 'speechSynthesis' in window;

// Prefer Edge "Natural" or Google UK/US English voices, then any en-US/en-GB voice.
function getPremiumVoice() {
  if (!hasSynthesis()) return null;
  const voices = window.speechSynthesis.getVoices();
  if (!voices || voices.length === 0) return null;

  const preferred = voices.find(
    (v) =>
      v.name.includes('Natural') ||
      v.name.includes('Google UK English') ||
      v.name.includes('Google US English'),
  );
  if (preferred) return preferred;

  const fallback = voices.find(
    (v) => v.lang === 'en-US' || v.lang === 'en-GB' || v.lang.startsWith('en-US') || v.lang.startsWith('en-GB'),
  );
  return fallback || voices[0] || null;
}

// Text-to-speech for the AI interviewer. Voices load asynchronously, so we
// subscribe to `voiceschanged` on mount.
export function useVoice() {
  useEffect(() => {
    if (!hasSynthesis()) return undefined;
    const handleVoicesChanged = () => window.speechSynthesis.getVoices();
    window.speechSynthesis.getVoices();
    window.speechSynthesis.onvoiceschanged = handleVoicesChanged;
    return () => {
      if (window.speechSynthesis.onvoiceschanged === handleVoicesChanged) {
        window.speechSynthesis.onvoiceschanged = null;
      }
      window.speechSynthesis.cancel();
    };
  }, []);

  const speak = useCallback((text) => {
    if (!text || !hasSynthesis()) return;
    try {
      window.speechSynthesis.cancel();
      const utterance = new SpeechSynthesisUtterance(text);
      utterance.voice = getPremiumVoice();
      utterance.pitch = 1.1;
      utterance.rate = 0.95;
      window.speechSynthesis.speak(utterance);
    } catch (err) {
      console.error('TTS synthesis failed:', err);
    }
  }, []);

  const cancel = useCallback(() => {
    if (hasSynthesis()) window.speechSynthesis.cancel();
  }, []);

  return { speak, cancel };
}
