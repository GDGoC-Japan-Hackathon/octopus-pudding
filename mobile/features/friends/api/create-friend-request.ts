import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import {
  type FriendRequestCreatePayload,
  type FriendRequestResponse,
} from '@/features/friends/types/friend-request';

export async function createFriendRequest(
  payload: FriendRequestCreatePayload
): Promise<FriendRequestResponse> {
  return apiFetch<FriendRequestResponse>(endpoints.users.friends.requestsCreate, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
