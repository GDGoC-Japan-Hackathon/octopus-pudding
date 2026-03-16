import { type AuthenticatedUser } from '@/features/auth/types/authenticated-user';
import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

type UploadProfileImageParams = {
  uri: string;
  fileName?: string | null;
  mimeType?: string | null;
};

export async function uploadProfileImage({
  uri,
  fileName,
  mimeType,
}: UploadProfileImageParams): Promise<AuthenticatedUser> {
  const formData = new FormData();
  formData.append('file', {
    uri,
    name: fileName ?? 'profile-image.jpg',
    type: mimeType ?? 'image/jpeg',
  } as unknown as Blob);

  return apiFetch<AuthenticatedUser>(endpoints.users.profileImage, {
    method: 'POST',
    body: formData,
  });
}
