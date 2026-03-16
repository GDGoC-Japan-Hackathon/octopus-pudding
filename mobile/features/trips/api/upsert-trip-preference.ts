import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import {
  type TripPreferenceResponse,
  type UpsertTripPreferenceRequest,
} from '@/features/trips/types/trip-edit';

export async function upsertTripPreference(
  tripId: number,
  payload: UpsertTripPreferenceRequest
): Promise<TripPreferenceResponse> {
  return apiFetch<TripPreferenceResponse>(endpoints.trips.preference.upsert(tripId), {
    method: 'PUT',
    body: JSON.stringify(payload),
  });
}
