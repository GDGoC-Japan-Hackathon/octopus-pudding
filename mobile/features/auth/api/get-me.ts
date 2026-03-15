import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

export type AuthenticatedUser = {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  firebase_uid?: string | null;
};

export async function fetchAuthenticatedUser(): Promise<AuthenticatedUser> {
  return apiFetch<AuthenticatedUser>(endpoints.auth.me);
}
