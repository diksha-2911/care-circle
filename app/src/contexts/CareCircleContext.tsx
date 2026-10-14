import { createContext, useContext, useEffect, useState, ReactNode } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../services/supabase';
import { getMyCircleMemberships } from '../services/circle';
import { CareCircleMembership } from '../types/circle';
import { registerDeviceTokenForUser } from '../services/deviceTokens';

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
    setActiveCircleIdState((prev) => {
      if (prev && rows.some((r) => r.circle_id === prev)) return prev;
      return rows[0]?.circle_id ?? null;
    });
  };

  useEffect(() => {
    let mounted = true;
    supabase.auth.getSession().then(({ data, error }) => {
      if (!mounted) return;
      if (error) console.error('Failed to restore auth session:', error.message);
      setSession(data.session);
      if (data.session?.user.id) {
        loadMemberships(data.session.user.id)
          .catch((loadError) => console.error('Failed to load care circles:', loadError))
          .finally(() => { if (mounted) setLoading(false); });
      } else {
        setLoading(false);
      }
    }).catch((error) => {
      console.error('Failed to restore auth session:', error);
      if (mounted) setLoading(false);
    });

    const { data: authListener } = supabase.auth.onAuthStateChange((_event, newSession) => {
      if (!mounted) return;
      setSession(newSession);
      if (newSession?.user.id) {
        setLoading(true);
        loadMemberships(newSession.user.id)
          .catch((error) => console.error('Failed to load care circles:', error))
          .finally(() => { if (mounted) setLoading(false); });
      } else {
        setMemberships([]);
        setActiveCircleIdState(null);
        setLoading(false);
      }
    });

    return () => {
      mounted = false;
      authListener.subscription.unsubscribe();
    };
  }, []);

  // Also register on restored sessions, not just the initial login screen.
  // The upsert is idempotent, so auth refreshes won't create duplicate rows.
  useEffect(() => {
    const currentUserId = session?.user.id;
    if (!currentUserId) return;
    let cancelled = false;
    registerDeviceTokenForUser(currentUserId).then((row) => {
      if (!cancelled && row) console.info('Device push registration is up to date.');
    }).catch((error) => {
      if (!cancelled) console.warn('Device push registration could not complete:', error?.message ?? error);
    });
    return () => { cancelled = true; };
  }, [session?.user.id]);

  const refreshMemberships = async () => {
    if (session?.user.id) await loadMemberships(session.user.id);
  };
  const activeCircle = memberships.find((m) => m.circle_id === activeCircleId) ?? null;

  return (
    <CareCircleContext.Provider value={{
      loading,
      session,
      userId: session?.user.id ?? null,
      memberships,
      activeCircle,
      setActiveCircleId: setActiveCircleIdState,
      refreshMemberships,
    }}>
      {children}
    </CareCircleContext.Provider>
  );
}

export function useCareCircle() {
  const ctx = useContext(CareCircleContext);
  if (!ctx) throw new Error('useCareCircle must be used within a CareCircleProvider');
  return ctx;
}
