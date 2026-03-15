import { onAuthStateChanged, User } from 'firebase/auth';
import React, { createContext, useContext, useEffect, useMemo, useState } from 'react';

import { fetchAuthenticatedUser, type AuthenticatedUser } from '@/features/auth/api/get-me';
import { configureApiClient } from '@/lib/api/client';
import { getFirebaseAuth, signInWithFirebaseEmail, signOutFromFirebase } from '@/lib/firebase/auth';

type AuthContextValue = {
  firebaseUser: User | null;
  backendUser: AuthenticatedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [backendUser, setBackendUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const getIdToken = async (forceRefresh = false): Promise<string | null> => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      return null;
    }
    return currentUser.getIdToken(forceRefresh);
  };

  useEffect(() => {
    configureApiClient(async (forceRefresh = false) => {
      const currentUser = getFirebaseAuth().currentUser;
      if (!currentUser) {
        return null;
      }
      return currentUser.getIdToken(forceRefresh);
    });
  }, []);

  useEffect(() => {
    const auth = getFirebaseAuth();
    const unsubscribe = onAuthStateChanged(auth, async (nextUser: User | null) => {
      setFirebaseUser(nextUser);
      if (!nextUser) {
        setBackendUser(null);
        setIsLoading(false);
        return;
      }

      try {
        const me = await fetchAuthenticatedUser();
        setBackendUser(me);
      } catch {
        setBackendUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, []);

  const signIn = async (email: string, password: string) => {
    setIsLoading(true);
    const user = await signInWithFirebaseEmail(email, password);
    setFirebaseUser(user);
    try {
      const me = await fetchAuthenticatedUser();
      setBackendUser(me);
    } finally {
      setIsLoading(false);
    }
  };

  const signOut = async () => {
    await signOutFromFirebase();
    setFirebaseUser(null);
    setBackendUser(null);
  };

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      backendUser,
      isLoading,
      isAuthenticated: !!firebaseUser,
      signIn,
      signOut,
      getIdToken,
    }),
    [firebaseUser, backendUser, isLoading]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuthContext() {
  const value = useContext(AuthContext);
  if (!value) {
    throw new Error('useAuthContext must be used inside AuthProvider');
  }
  return value;
}
