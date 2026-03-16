import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import {
  type CreateItineraryItemRequest,
  type ItineraryItemResponse,
} from '@/features/trips/types/trip-edit';

export async function createItineraryItem(
  tripId: number,
  dayId: number,
  payload: CreateItineraryItemRequest
): Promise<ItineraryItemResponse> {
  return apiFetch<ItineraryItemResponse>(endpoints.trips.days.items.create(tripId, dayId), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
