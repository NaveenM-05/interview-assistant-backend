import { useCallback, useEffect, useState } from 'react';
import { USER_ID } from '../config';
import { getVerifiedProgress } from '../lib/verifiedApi';

/**
 * Which DSA topics are unlocked for coding (Verified warm-up gate).
 * Fails open: if progress can't be loaded, nothing is locked, so the
 * existing interview flow keeps working even if the warm-up backend is down.
 */
export function useTopicGate() {
  const [state, setState] = useState({ loading: true, progress: null, error: null });

  useEffect(() => {
    let alive = true;
    getVerifiedProgress(USER_ID)
      .then((progress) => alive && setState({ loading: false, progress, error: null }))
      .catch((err) => alive && setState({ loading: false, progress: null, error: err.message }));
    return () => {
      alive = false;
    };
  }, []);

  const info = useCallback((topic) => state.progress?.topics?.[topic] ?? null, [state.progress]);
  const isLocked = useCallback((topic) => {
    const i = info(topic);
    return Boolean(i && !i.unlocked);
  }, [info]);

  return {
    loading: state.loading,
    error: state.error,
    threshold: state.progress?.threshold ?? 0.7,
    info,
    isLocked,
  };
}
