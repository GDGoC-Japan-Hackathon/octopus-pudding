import AsyncStorage from '@react-native-async-storage/async-storage';
import {
  Auth,
  User,
  createUserWithEmailAndPassword,
  getAuth,
  initializeAuth,
  signInWithEmailAndPassword,
  signOut,
} from 'firebase/auth';
import * as FirebaseAuthModule from 'firebase/auth';

import { getFirebaseApp } from '@/lib/firebase/config';

let authInstance: Auth | null = null;

export function getFirebaseAuth(): Auth {
  if (authInstance) {
    return authInstance;
  }

  const app = getFirebaseApp();
  try {
    const getReactNativePersistence = (
      FirebaseAuthModule as unknown as {
        getReactNativePersistence?: (storage: unknown) => unknown;
      }
    ).getReactNativePersistence;

    if (getReactNativePersistence) {
      authInstance = initializeAuth(app, {
        persistence: getReactNativePersistence(AsyncStorage) as never,
      });
    } else {
      authInstance = initializeAuth(app);
    }
  } catch {
    authInstance = getAuth(app);
  }
  return authInstance;
}

export async function signInWithFirebaseEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  console.log('Firebase signIn start', { email });
  const credential = await signInWithEmailAndPassword(auth, email, password);
  console.log('Firebase signIn success', { uid: credential.user.uid });
  return credential.user;
}

export async function signUpWithFirebaseEmail(email: string, password: string): Promise<User> {
  const auth = getFirebaseAuth();
  console.log('Firebase signUp start', { email });
  const credential = await createUserWithEmailAndPassword(auth, email, password);
  console.log('Firebase signUp success', { uid: credential.user.uid });
  return credential.user;
}

export async function signOutFromFirebase(): Promise<void> {
  const auth = getFirebaseAuth();
  await signOut(auth);
}
