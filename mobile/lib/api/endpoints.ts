export const API_BASE_URL =
  process.env.EXPO_PUBLIC_API_BASE_URL ?? 'http://10.0.2.2:8000/api/v1';

export const endpoints = {
  auth: {
    me: '/auth/me',
  },
  users: {
    me: '/users/me',
    profileImage: '/users/me/profile-image',
    profileImageGet: '/users/me/profile-image',
    friends: {
      list: '/users/me/friends',
      requestsCreate: '/users/me/friends/requests',
      requestsIncoming: '/users/me/friends/requests/incoming',
      requestsOutgoing: '/users/me/friends/requests/outgoing',
      requestsUpdate: (requestId: number | string) => `/users/me/friends/requests/${requestId}`,
    },
  },
  recommendations: {
    list: '/recommendations/',
    detail: (recommendationId: number | string) => `/recommendations/${recommendationId}`,
    clone: (recommendationId: number | string) => `/recommendations/${recommendationId}/clone`,
  },
  trips: {
    create: '/trips/',
    list: '/trips/',
    detail: (tripId: number | string) => `/trips/${tripId}`,
    update: (tripId: number | string) => `/trips/${tripId}`,
    delete: (tripId: number | string) => `/trips/${tripId}`,
    preference: {
      upsert: (tripId: number | string) => `/trips/${tripId}/preference`,
    },
    members: {
      create: (tripId: number | string) => `/trips/${tripId}/members`,
      delete: (tripId: number | string, userId: number | string) => `/trips/${tripId}/members/${userId}`,
    },
    days: {
      create: (tripId: number | string) => `/trips/${tripId}/days`,
      items: {
        create: (tripId: number | string, dayId: number | string) => `/trips/${tripId}/days/${dayId}/items`,
      },
    },
    incidents: {
      create: (tripId: number | string) => `/trips/${tripId}/incidents`,
      list: (tripId: number | string) => `/trips/${tripId}/incidents`,
    },
    replans: {
      create: (tripId: number | string) => `/trips/${tripId}/replans`,
      detail: (tripId: number | string, sessionId: number | string) =>
        `/trips/${tripId}/replans/${sessionId}`,
    },
    aiPlanGenerations: {
      create: (tripId: number | string) => `/trips/${tripId}/ai-plan-generations`,
      detail: (tripId: number | string, generationId: number | string) =>
        `/trips/${tripId}/ai-plan-generations/${generationId}`,
    },
  },
} as const;
