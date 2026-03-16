import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type TripResponse } from '@/features/trips/types/trip-edit';

export async function getTrips(): Promise<TripResponse[]> {
  return apiFetch<TripResponse[]>(endpoints.trips.list);
}
