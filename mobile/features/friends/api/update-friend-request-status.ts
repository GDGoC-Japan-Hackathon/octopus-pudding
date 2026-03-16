import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import {
  type FriendRequestDecisionStatus,
  type FriendRequestResponse,
  type FriendRequestUpdatePayload,
} from '@/features/friends/types/friend-request';

export async function updateFriendRequestStatus(
  requestId: number,
  status: FriendRequestDecisionStatus
): Promise<FriendRequestResponse> {
  const payload: FriendRequestUpdatePayload = { status };
  return apiFetch<FriendRequestResponse>(endpoints.users.friends.requestsUpdate(requestId), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
