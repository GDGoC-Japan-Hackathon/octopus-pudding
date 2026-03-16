import { onAuthStateChanged, User } from 'firebase/auth';
import React, { createContext, useCallback, useContext, useEffect, useMemo, useState } from 'react';

import { fetchAuthenticatedUserWithToken } from '@/features/auth/api/get-me';
import { type AuthenticatedUser } from '@/features/auth/types/authenticated-user';
import { configureApiClient } from '@/lib/api/client';
import {
  getFirebaseAuth,
  signInWithFirebaseEmail,
  signOutFromFirebase,
  signUpWithFirebaseEmail,
} from '@/lib/firebase/auth';

type AuthContextValue = {
  firebaseUser: User | null;
  backendUser: AuthenticatedUser | null;
  isLoading: boolean;
  isAuthenticated: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  getIdToken: (forceRefresh?: boolean) => Promise<string | null>;
  refreshBackendUser: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [backendUser, setBackendUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncBackendUser = useCallback(async (user: User): Promise<AuthenticatedUser> => {
    const idToken = await user.getIdToken(true);
    return fetchAuthenticatedUserWithToken(idToken);
  }, []);

  const getIdToken = useCallback(async (forceRefresh = false): Promise<string | null> => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      return null;
    }
    return currentUser.getIdToken(forceRefresh);
  }, []);

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
        const me = await syncBackendUser(nextUser);
        setBackendUser(me);
      } catch {
        setBackendUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [syncBackendUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const user = await signInWithFirebaseEmail(email, password);
      const me = await syncBackendUser(user);
      setFirebaseUser(user);
      setBackendUser(me);
    } catch (error) {
      setFirebaseUser(null);
      setBackendUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [syncBackendUser]);

  const signUp = useCallback(async (email: string, password: string) => {
    setIsLoading(true);
    try {
      const user = await signUpWithFirebaseEmail(email, password);
      const me = await syncBackendUser(user);
      setFirebaseUser(user);
      setBackendUser(me);
    } catch (error) {
      setFirebaseUser(null);
      setBackendUser(null);
      throw error;
    } finally {
      setIsLoading(false);
    }
  }, [syncBackendUser]);

  const signOut = useCallback(async () => {
    await signOutFromFirebase();
    setFirebaseUser(null);
    setBackendUser(null);
  }, []);

  const refreshBackendUser = useCallback(async () => {
    const currentUser = getFirebaseAuth().currentUser;
    if (!currentUser) {
      setBackendUser(null);
      return;
    }

    const me = await syncBackendUser(currentUser);
    setBackendUser(me);
  }, [syncBackendUser]);

  const value = useMemo<AuthContextValue>(
    () => ({
      firebaseUser,
      backendUser,
      isLoading,
      isAuthenticated: !!firebaseUser && !!backendUser,
      signIn,
      signUp,
      signOut,
      getIdToken,
      refreshBackendUser,
    }),
    [firebaseUser, backendUser, isLoading, signIn, signUp, signOut, getIdToken, refreshBackendUser]
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
