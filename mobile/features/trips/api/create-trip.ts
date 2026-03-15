import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

type TripAtmosphere = 'のんびり' | 'アクティブ' | 'グルメ' | '映え';

export type CreateTripRequest = {
  origin: string;
  destination: string;
  start_date: string;
  end_date: string;
  status?: 'planned' | 'ongoing' | 'completed';
  preference?: {
    atmosphere: TripAtmosphere;
    companions?: string;
    budget?: number;
    transport_type?: string;
  };
};

export type CreateTripResponse = {
  trip: {
    id: number;
    user_id: number;
    origin: string;
    destination: string;
    start_date: string;
    end_date: string;
    status: string;
    created_at?: string | null;
    updated_at?: string | null;
  };
  preference?: {
    id: number;
    trip_id: number;
    atmosphere: TripAtmosphere;
    companions?: string | null;
    budget?: number | null;
    transport_type?: string | null;
    created_at?: string | null;
  } | null;
  members: Array<{
    id: number;
    trip_id: number;
    user_id: number;
    role: string;
    status: string;
  }>;
  days: Array<{
    id: number;
    trip_id: number;
    day_number: number;
    date?: string | null;
  }>;
  itinerary_items: Array<{
    id: number;
    trip_day_id: number;
    name: string;
  }>;
};

export async function createTrip(payload: CreateTripRequest): Promise<CreateTripResponse> {
  return apiFetch<CreateTripResponse>(endpoints.trips.create, {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}
