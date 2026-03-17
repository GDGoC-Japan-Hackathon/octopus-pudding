import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type TripDetailAggregateResponse } from '@/features/trips/types/trip-detail';

export async function getTripDetail(tripId: number): Promise<TripDetailAggregateResponse> {
  return apiFetch<TripDetailAggregateResponse>(endpoints.trips.detail(tripId));
}
