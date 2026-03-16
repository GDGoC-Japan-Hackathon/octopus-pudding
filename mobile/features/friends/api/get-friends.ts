import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type FriendsResponse } from '@/features/friends/types/friend-request';

export async function getFriends(): Promise<FriendsResponse> {
  return apiFetch<FriendsResponse>(endpoints.users.friends.list);
}
