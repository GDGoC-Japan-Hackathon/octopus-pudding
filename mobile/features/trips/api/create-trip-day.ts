import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type CreateTripDayRequest, type TripDayResponse } from '@/features/trips/types/trip-edit';

export async function createTripDay(tripId: number, payload: CreateTripDayRequest): Promise<TripDayResponse> {
  return apiFetch<TripDayResponse>(endpoints.trips.days.create(tripId), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
