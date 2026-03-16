import { ApiError } from '@/lib/api/client';
import { API_BASE_URL, endpoints } from '@/lib/api/endpoints';
import { getFirebaseAuth } from '@/lib/firebase/auth';

function blobToDataUri(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('Failed to read image blob'));
    reader.onloadend = () => resolve(String(reader.result));
    reader.readAsDataURL(blob);
  });
}

export async function getMyProfileImageBinary(): Promise<string> {
  const currentUser = getFirebaseAuth().currentUser;
  if (!currentUser) {
    throw new ApiError('Unauthorized', 401);
  }

  const request = async (token: string): Promise<Response> =>
    fetch(`${API_BASE_URL}${endpoints.users.profileImageGet}`, {
      method: 'GET',
      headers: {
        Authorization: `Bearer ${token}`,
      },
    });

  let token = await currentUser.getIdToken(false);
  let response = await request(token);

  if (response.status === 401) {
    token = await currentUser.getIdToken(true);
    response = await request(token);
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(errorText || 'Request failed', response.status);
  }

  const blob = await response.blob();
  return blobToDataUri(blob);
}
