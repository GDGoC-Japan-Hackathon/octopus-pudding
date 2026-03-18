import { type TripAtmosphere } from '@/features/trips/types/create-trip';

export type TripDetailResponse = {
  id: number;
  user_id: number;
  origin: string;
  destination: string;
  start_date: string;
  end_date: string;
  participant_count: number;
  recommendation_categories?: string[] | null;
  status: string;
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
  created_at?: string | null;
};

export type TripDetailItineraryItemResponse = {
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

export type TripDetailAggregateResponse = {
  trip: TripDetailResponse;
  preference?: TripDetailPreferenceResponse | null;
  members: TripDetailMemberResponse[];
  days: TripDetailDayResponse[];
  itinerary_items: TripDetailItineraryItemResponse[];
};
