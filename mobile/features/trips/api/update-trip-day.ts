import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type TripDayResponse, type UpdateTripDayRequest } from '@/features/trips/types/trip-edit';

export async function updateTripDay(
  tripId: number,
  dayId: number,
  payload: UpdateTripDayRequest
): Promise<TripDayResponse> {
  return apiFetch<TripDayResponse>(endpoints.trips.days.update(tripId, dayId), {
    method: 'PATCH',
    body: JSON.stringify(payload),
  });
}
