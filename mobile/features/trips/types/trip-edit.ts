import { type TripAtmosphere } from '@/features/trips/types/create-trip';

export type TripStatus = 'planned' | 'ongoing' | 'completed';

export type TripResponse = {
  id: number;
  user_id: number;
  origin: string;
  destination: string;
  start_date: string;
  end_date: string;
  participant_count: number;
  source_trip_id?: number | null;
  counts_as_saved_recommendation?: boolean;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TripPreferenceResponse = {
  id: number;
  trip_id: number;
  atmosphere: TripAtmosphere;
  companions?: string | null;
  budget?: number | null;
  transport_type?: string | null;
  created_at?: string | null;
};

export type TripDayResponse = {
  id: number;
  trip_id: number;
  day_number: number;
  date?: string | null;
  created_at?: string | null;
};

export type ItineraryItemResponse = {
  id: number;
  trip_day_id: number;
  name: string;
  category?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  estimated_cost?: number | null;
  notes?: string | null;
  created_at?: string | null;
};

export type TripAggregateResponse = {
  trip: TripResponse;
  preference?: TripPreferenceResponse | null;
  members: TripMemberResponse[];
  days: TripDayResponse[];
  itinerary_items: ItineraryItemResponse[];
};

export type TripMemberResponse = {
  id: number;
  trip_id: number;
  user_id: number;
  role: string;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type UpdateTripRequest = {
  origin?: string;
  destination?: string;
  start_date?: string;
  end_date?: string;
  participant_count?: number;
  status?: TripStatus;
};

export type UpsertTripPreferenceRequest = {
  atmosphere: TripAtmosphere;
  companions?: string;
  budget?: number;
  transport_type?: string;
};

export type CreateTripDayRequest = {
  day_number: number;
  date?: string;
};

export type CreateItineraryItemRequest = {
  name: string;
  category?: string;
  estimated_cost?: number;
  notes?: string;
};
