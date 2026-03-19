export const TRIP_STATUSES = ['planned', 'ongoing', 'completed'] as const;

export type TripStatus = (typeof TRIP_STATUSES)[number];
