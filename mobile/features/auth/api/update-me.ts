import { type AuthenticatedUser } from '@/features/auth/types/authenticated-user';
import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

export type UpdateMePayload = {
  username?: string;
  profile_image_url?: string | null;
  nearest_station?: string | null;
};

export async function updateMe(payload: UpdateMePayload): Promise<AuthenticatedUser> {
  return apiFetch<AuthenticatedUser>(endpoints.users.me, {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
