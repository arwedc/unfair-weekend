/** Wer ist angemeldet? Session aus Supabase, Kontodaten (Name, Sperre) aus `get_my_account`. */
import type { Session } from '@supabase/supabase-js';
import { useQuery, useQueryClient } from '@tanstack/react-query';
import { createContext, use, useEffect, useState, type ReactNode } from 'react';

import { supabase } from '@/lib/supabase';

import type { Account } from './account';
import { fetchAccount } from './api';

/** Abfragen, die zum angemeldeten Nutzer gehören. Beim Abmelden werden sie geleert. */
export const userKeys = {
  all: ['user'] as const,
  account: (userId: string) => [...userKeys.all, userId, 'account'] as const,
  vouchers: (userId: string) => [...userKeys.all, userId, 'vouchers'] as const,
  favoriteLocations: (userId: string) => [...userKeys.all, userId, 'favorite-locations'] as const,
  favoriteCategories: (userId: string) => [...userKeys.all, userId, 'favorite-categories'] as const,
};

interface AuthContextValue {
  /** false, solange die gespeicherte Session noch geladen wird. */
  ready: boolean;
  userId: string | null;
  email: string | null;
  /** Wann das Konto angelegt wurde (ISO), für „Dabei seit …“ im Profil. */
  memberSince: string | null;
  /** Name, den der Login-Anbieter (z. B. Google) mitliefert. Vorschlag für das Profil. */
  suggestedName: string;
  account: Account | null;
  accountLoading: boolean;
  accountError: unknown;
  refetchAccount: () => Promise<unknown>;
}

const AuthContext = createContext<AuthContextValue | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const queryClient = useQueryClient();
  const [state, setState] = useState<{ ready: boolean; session: Session | null }>({
    ready: false,
    session: null,
  });

  useEffect(() => {
    // Liefert sofort INITIAL_SESSION mit der gespeicherten Session (oder null).
    const { data } = supabase.auth.onAuthStateChange((event, session) => {
      setState({ ready: true, session });
      if (event === 'SIGNED_OUT') queryClient.removeQueries({ queryKey: userKeys.all });
    });
    return () => data.subscription.unsubscribe();
  }, [queryClient]);

  const userId = state.session?.user.id ?? null;
  const metadata: Record<string, unknown> = state.session?.user.user_metadata ?? {};
  const providerName = metadata.full_name ?? metadata.name;
  const accountQuery = useQuery({
    queryKey: userKeys.account(userId ?? 'anon'),
    queryFn: fetchAccount,
    enabled: userId !== null,
  });

  return (
    <AuthContext
      value={{
        ready: state.ready,
        userId,
        email: state.session?.user.email ?? null,
        memberSince: state.session?.user.created_at ?? null,
        suggestedName: typeof providerName === 'string' ? providerName : '',
        account: userId ? (accountQuery.data ?? null) : null,
        accountLoading: userId !== null && accountQuery.isPending,
        accountError: userId ? accountQuery.error : null,
        refetchAccount: () => accountQuery.refetch(),
      }}
    >
      {children}
    </AuthContext>
  );
}

export function useAuth(): AuthContextValue {
  const value = use(AuthContext);
  if (!value) throw new Error('useAuth braucht den AuthProvider im Root-Layout.');
  return value;
}
