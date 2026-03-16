import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type IncomingFriendRequestsResponse } from '@/features/friends/types/friend-request';

export async function getIncomingFriendRequests(): Promise<IncomingFriendRequestsResponse> {
  return apiFetch<IncomingFriendRequestsResponse>(endpoints.users.friends.requestsIncoming);
}
