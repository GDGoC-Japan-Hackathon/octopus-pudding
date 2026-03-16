import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

export type ProfileImageUrlResponse = {
  signed_url: string;
  expires_in_seconds: number;
};

export async function getMyProfileImageUrl(): Promise<ProfileImageUrlResponse> {
  return apiFetch<ProfileImageUrlResponse>(endpoints.users.profileImageUrl);
}
