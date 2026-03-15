import { API_BASE_URL } from '@/lib/api/endpoints';

type TokenProvider = (forceRefresh?: boolean) => Promise<string | null>;

let tokenProvider: TokenProvider = async () => null;

export function configureApiClient(provider: TokenProvider): void {
  tokenProvider = provider;
}

export class ApiError extends Error {
  status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
  }
}

export async function apiFetch<T>(path: string, init: RequestInit = {}): Promise<T> {
  const token = await tokenProvider(false);
  const headers = new Headers(init.headers ?? {});

  if (!headers.has('Content-Type') && init.body) {
    headers.set('Content-Type', 'application/json');
  }
  if (!headers.has('Accept')) {
    headers.set('Accept', 'application/json');
  }
  if (token) {
    headers.set('Authorization', `Bearer ${token}`);
  }

  const response = await fetch(`${API_BASE_URL}${path}`, {
    ...init,
    headers,
  });

  if (response.status === 401) {
    const refreshedToken = await tokenProvider(true);
    if (refreshedToken) {
      headers.set('Authorization', `Bearer ${refreshedToken}`);
      const retried = await fetch(`${API_BASE_URL}${path}`, {
        ...init,
        headers,
      });
      if (retried.ok) {
        return (await retried.json()) as T;
      }
      const retriedError = await retried.text();
      throw new ApiError(retriedError || 'Request failed', retried.status);
    }
  }

  if (!response.ok) {
    const errorText = await response.text();
    throw new ApiError(errorText || 'Request failed', response.status);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}
