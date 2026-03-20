import { type TripAtmosphere } from '@/features/trips/types/create-trip';
import { type TripStatus } from '@/features/trips/types/trip-status';

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
  cover_image_url?: string | null;
  recommendation_comment?: string | null;
  recommendation_categories?: string[] | null;
  status: TripStatus;
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
  must_visit_places_text?: string | null;
  additional_request_comment?: string | null;
  created_at?: string | null;
};

export type TripDayResponse = {
  id: number;
  trip_id: number;
  day_number: number;
  date?: string | null;
  lodging_note?: string | null;
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
  recommendation_categories?: string[];
  status?: TripStatus;
};

export type UpsertTripPreferenceRequest = {
  atmosphere: TripAtmosphere;
  companions?: string;
  budget?: number;
  transport_type?: string;
  must_visit_places_text?: string | null;
  additional_request_comment?: string | null;
};

export type CreateTripDayRequest = {
  day_number: number;
  date?: string;
};

export type UpdateTripDayRequest = {
  day_number?: number;
  date?: string;
  lodging_note?: string | null;
};

export type TripTransportMode =
  | 'car'
  | 'train'
  | 'bus'
  | 'walk'
  | 'bicycle'
  | 'plane'
  | 'ship'
  | 'taxi'
  | 'other';

export type CreateItineraryItemRequest = {
  name: string;
  item_type?: 'place' | 'transport';
  category?: string;
  transport_mode?: TripTransportMode;
  travel_minutes?: number;
  distance_meters?: number;
  from_name?: string;
  to_name?: string;
  latitude?: number;
  longitude?: number;
  start_time?: string;
  end_time?: string;
  estimated_cost?: number;
  notes?: string;
  line_name?: string;
  vehicle_type?: string;
  departure_stop_name?: string;
  arrival_stop_name?: string;
};
