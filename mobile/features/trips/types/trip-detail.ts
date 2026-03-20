import { type TripAtmosphere } from '@/features/trips/types/create-trip';
import { type TripStatus } from '@/features/trips/types/trip-status';

export type TripDetailResponse = {
  id: number;
  user_id: number;
  source_trip_id?: number | null;
  origin: string;
  destination: string;
  start_date: string;
  end_date: string;
  participant_count: number;
  cover_image_url?: string | null;
  recommendation_comment?: string | null;
  recommendation_categories?: string[] | null;
  status: TripStatus;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TripDetailPreferenceResponse = {
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

export type TripDetailMemberResponse = {
  id: number;
  trip_id: number;
  user_id: number;
  role: string;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
};

export type TripDetailDayResponse = {
  id: number;
  trip_id: number;
  day_number: number;
  date?: string | null;
  lodging_note?: string | null;
  created_at?: string | null;
};

export type TripDetailItineraryItemResponse = {
  id: number;
  trip_day_id: number;
  name: string;
  item_type?: string;
  category?: string | null;
  transport_mode?: string | null;
  travel_minutes?: number | null;
  distance_meters?: number | null;
  from_name?: string | null;
  to_name?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  estimated_cost?: number | null;
  notes?: string | null;
  line_name?: string | null;
  vehicle_type?: string | null;
  departure_stop_name?: string | null;
  arrival_stop_name?: string | null;
  created_at?: string | null;
};

export type TripDetailAggregateResponse = {
  trip: TripDetailResponse;
  preference?: TripDetailPreferenceResponse | null;
  members: TripDetailMemberResponse[];
  days: TripDetailDayResponse[];
  itinerary_items: TripDetailItineraryItemResponse[];
};
