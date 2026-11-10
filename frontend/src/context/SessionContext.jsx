import { useEffect, useMemo, useState } from 'react';
import { SessionContext } from './session';

const KEY = 'ia.session.v1';

function load() {
  try {
    return JSON.parse(sessionStorage.getItem(KEY)) ?? null;
  } catch {
    return null;
  }
}

// Holds the active interview (type, topic, difficulty, generated question,
// session id) between the setup page and the interview room. Survives a refresh.
export function SessionProvider({ children }) {
  const [session, setSession] = useState(load);

  useEffect(() => {
    try {
      if (session) sessionStorage.setItem(KEY, JSON.stringify(session));
      else sessionStorage.removeItem(KEY);
    } catch {
      /* storage unavailable: keep it in memory */
    }
  }, [session]);

  const value = useMemo(
    () => ({ session, startSession: setSession, endSession: () => setSession(null) }),
    [session],
  );

  return <SessionContext.Provider value={value}>{children}</SessionContext.Provider>;
}
