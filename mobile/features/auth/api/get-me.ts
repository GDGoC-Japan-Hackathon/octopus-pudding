import { apiFetch } from '@/lib/api/client';
import { type AuthenticatedUser } from '@/features/auth/types/authenticated-user';
import { endpoints } from '@/lib/api/endpoints';

export async function fetchAuthenticatedUser(): Promise<AuthenticatedUser> {
  return apiFetch<AuthenticatedUser>(endpoints.users.me);
}

export async function fetchAuthenticatedUserWithToken(token: string): Promise<AuthenticatedUser> {
  return apiFetch<AuthenticatedUser>(endpoints.users.me, {
    headers: {
      Authorization: `Bearer ${token}`,
    },
  });
}
