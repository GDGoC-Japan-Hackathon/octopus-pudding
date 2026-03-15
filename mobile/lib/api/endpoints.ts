export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8000/api/v1';

export const endpoints = {
  auth: {
    me: '/auth/me',
  },
  users: {
    me: '/users/me',
  },
  trips: {
    list: '/trips',
    detail: (tripId: number | string) => `/trips/${tripId}`,
  },
} as const;
