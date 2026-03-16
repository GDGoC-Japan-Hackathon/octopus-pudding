import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type TripResponse, type UpdateTripRequest } from '@/features/trips/types/trip-edit';

export async function updateTrip(tripId: number, payload: UpdateTripRequest): Promise<TripResponse> {
  return apiFetch<TripResponse>(endpoints.trips.update(tripId), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
