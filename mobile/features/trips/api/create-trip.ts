import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type CreateTripRequest, type CreateTripResponse } from '@/features/trips/types/create-trip';

export async function createTrip(payload: CreateTripRequest): Promise<CreateTripResponse> {
  return apiFetch<CreateTripResponse>(endpoints.trips.create, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
