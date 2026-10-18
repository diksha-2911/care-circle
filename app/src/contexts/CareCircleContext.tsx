import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { getMyCircleMemberships } from '../services/circle';
import { CareCircleMembership } from '../types/circle';

interface CareCircleContextValue {
  loading: boolean;
  session: Session | null;
  userId: string | null;
  memberships: CareCircleMembership[];
  activeCircle: CareCircleMembership | null;
  setActiveCircleId: (circleId: string) => void;
  refreshMemberships: () => Promise<void>;
}

const CareCircleContext = createContext<CareCircleContextValue | undefined>(undefined);

export function CareCircleProvider({ children }: { children: ReactNode }) {
  const [loading, setLoading] = useState(true);
  const [session, setSession] = useState<Session | null>(null);
  const [memberships, setMemberships] = useState<CareCircleMembership[]>([]);
  const [activeCircleId, setActiveCircleIdState] = useState<string | null>(null);

  const loadMemberships = async (userId: string) => {
    const rows = await getMyCircleMemberships(userId);
    setMemberships(rows);
    // Default to the first circle if none is selected yet, or if the
    // previously-active one is no longer in the list (e.g. removed).
    setActiveCircleIdState((prev) => {
      if (prev && rows.some((r) => r.circle_id === prev)) return prev;
      return rows[0]?.circle_id ?? null;
    });
  };

  useEffect(() => {
    // Initial session check on app launch.
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.user.id) {
        loadMemberships(data.session.user.id).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    // Keep session (and memberships) in sync across login/logout, and
    // across devices sharing the same account.
    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession?.user.id) {
        setLoading(true);
        loadMemberships(newSession.user.id).finally(() => setLoading(false));
      } else {
        setMemberships([]);
        setActiveCircleIdState(null);
      }
    });

    return () => authListener.subscription.unsubscribe();
  }, []);

  const refreshMemberships = async () => {
    if (session?.user.id) await loadMemberships(session.user.id);
  };

  const activeCircle = memberships.find((m) => m.circle_id === activeCircleId) ?? null;

  return (
    <CareCircleContext.Provider
      value={{
        loading,
        session,
        userId: session?.user.id ?? null,
        memberships,
        activeCircle,
        setActiveCircleId: setActiveCircleIdState,
        refreshMemberships,
      }}
    >
      {children}
    </CareCircleContext.Provider>
  );
}

export function useCareCircle() {
  const ctx = useContext(CareCircleContext);
  if (!ctx) throw new Error('useCareCircle must be used within a CareCircleProvider');
  return ctx;
}
