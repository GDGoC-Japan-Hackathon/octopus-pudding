import { type TripStatus } from '@/features/trips/types/trip-status';

export type TripAtmosphere = 'のんびり' | 'アクティブ' | 'グルメ' | '映え';

export type CreateTripRequest = {
  origin: string;
  destination: string;
  start_date: string;
  end_date: string;
  participant_count: number;
  cover_image_url?: string;
  recommendation_comment?: string;
  recommendation_categories?: string[];
  status?: 'planned' | 'ongoing' | 'completed';
  preference?: {
    atmosphere: TripAtmosphere;
    companions?: string;
    budget?: number;
    transport_type?: string;
    must_visit_places_text?: string;
    additional_request_comment?: string;
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
    participant_count: number;
    status: TripStatus;
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
    must_visit_places_text?: string | null;
    additional_request_comment?: string | null;
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
    lodging_note?: string | null;
  }>;
  itinerary_items: Array<{
    id: number;
    trip_day_id: number;
    name: string;
  }>;
};
