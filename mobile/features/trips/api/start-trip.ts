import { updateTrip } from '@/features/trips/api/update-trip';
import { type TripResponse } from '@/features/trips/types/trip-edit';

export async function startTrip(tripId: number): Promise<TripResponse> {
  return updateTrip(tripId, { status: 'ongoing' });
}
