import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type OutgoingFriendRequestsResponse } from '@/features/friends/types/friend-request';

export async function getOutgoingFriendRequests(): Promise<OutgoingFriendRequestsResponse> {
  return apiFetch<OutgoingFriendRequestsResponse>(endpoints.users.friends.requestsOutgoing);
}
