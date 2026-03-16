export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8000/api/v1';

export const endpoints = {
  auth: {
    me: '/auth/me',
  },
  users: {
    me: '/users/me',
    profileImage: '/users/me/profile-image',
  },
  trips: {
    create: '/trips',
    list: '/trips',
    detail: (tripId: number | string) => `/trips/${tripId}`,
    incidents: {
      create: (tripId: number | string) => `/trips/${tripId}/incidents`,
      list: (tripId: number | string) => `/trips/${tripId}/incidents`,
    },
    replans: {
      create: (tripId: number | string) => `/trips/${tripId}/replans`,
      detail: (tripId: number | string, sessionId: number | string) =>
        `/trips/${tripId}/replans/${sessionId}`,
    },
  },
} as const;
