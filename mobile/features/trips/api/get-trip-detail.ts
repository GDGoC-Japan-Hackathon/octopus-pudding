import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type TripAggregateResponse } from '@/features/trips/types/trip-edit';

export async function getTripDetail(tripId: number): Promise<TripAggregateResponse> {
  return apiFetch<TripAggregateResponse>(endpoints.trips.detail(tripId));
}
