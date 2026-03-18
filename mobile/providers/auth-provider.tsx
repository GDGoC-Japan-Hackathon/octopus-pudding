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
  setBackendUser: (user: AuthenticatedUser) => void;
};

type FirebaseAuthLikeError = {
  code?: string;
};

const HANDLED_AUTH_ERROR_CODES = new Set([
  'auth/email-already-in-use',
  'auth/invalid-credential',
  'auth/invalid-email',
  'auth/too-many-requests',
  'auth/user-not-found',
  'auth/weak-password',
  'auth/wrong-password',
]);

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

function getFirebaseAuthErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error && 'code' in error) {
    return (error as FirebaseAuthLikeError).code ?? null;
  }

  return null;
}

function logAuthFailure(action: 'signIn' | 'signUp', error: unknown) {
  const code = getFirebaseAuthErrorCode(error);

  if (code && HANDLED_AUTH_ERROR_CODES.has(code)) {
    console.log(`Context ${action} rejected`, { code });
    return;
  }

  console.error(`Context ${action} failed`, error);
}

export function AuthProvider({ children }: { children: React.ReactNode }) {
  const [firebaseUser, setFirebaseUser] = useState<User | null>(null);
  const [backendUser, setBackendUser] = useState<AuthenticatedUser | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const syncBackendUser = useCallback(async (user: User): Promise<AuthenticatedUser> => {
    console.log('Backend sync start', { uid: user.uid, email: user.email });
    const idToken = await user.getIdToken(true);
    const authenticatedUser = await fetchAuthenticatedUserWithToken(idToken);
    console.log('Backend sync success', { id: authenticatedUser.id, email: authenticatedUser.email });
    return authenticatedUser;
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
      console.log('onAuthStateChanged', {
        uid: nextUser?.uid ?? null,
        email: nextUser?.email ?? null,
      });
      setFirebaseUser(nextUser);
      if (!nextUser) {
        setBackendUser(null);
        setIsLoading(false);
        return;
      }

      setIsLoading(true);

      try {
        const me = await syncBackendUser(nextUser);
        setBackendUser(me);
      } catch (error) {
        console.error('Backend sync from auth state failed', error);
        setBackendUser(null);
      } finally {
        setIsLoading(false);
      }
    });

    return unsubscribe;
  }, [syncBackendUser]);

  const signIn = useCallback(async (email: string, password: string) => {
    try {
      console.log('Context signIn start', { email });
      await signInWithFirebaseEmail(email, password);
    } catch (error) {
      logAuthFailure('signIn', error);
      setFirebaseUser(null);
      setBackendUser(null);
      setIsLoading(false);
      throw error;
    }
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    try {
      console.log('Context signUp start', { email });
      await signUpWithFirebaseEmail(email, password);
    } catch (error) {
      logAuthFailure('signUp', error);
      setFirebaseUser(null);
      setBackendUser(null);
      setIsLoading(false);
      throw error;
    }
  }, []);

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
      setBackendUser,
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
