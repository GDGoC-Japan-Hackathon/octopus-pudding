import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

export async function deleteTrip(tripId: number | string): Promise<void> {
  await apiFetch<void>(endpoints.trips.delete(tripId), {
    method: 'DELETE',
  });
}
