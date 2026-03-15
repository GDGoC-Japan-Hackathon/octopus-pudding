import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

export type IncidentResponse = {
  id: number;
  trip_id: number;
  incident_type?: string | null;
  description?: string | null;
  occurred_at?: string | null;
  created_at?: string | null;
};

export type ReplanItem = {
  id: number;
  replan_session_id: number;
  name: string;
  category?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  start_time?: string | null;
  estimated_cost?: number | null;
  replacement_for_item_id?: number | null;
  created_at?: string | null;
};

export type ReplanSession = {
  id: number;
  trip_id: number;
  incident_id?: number | null;
  reason?: string | null;
  created_at?: string | null;
};

export type ReplanAggregateResponse = {
  session: ReplanSession;
  items: ReplanItem[];
};

export type CreateIncidentPayload = {
  incident_type: string;
  description?: string;
  occurred_at?: string;
};

export type CreateReplanPayload = {
  incident_id?: number;
  reason?: string;
  items?: Array<{
    name: string;
    category?: string;
    latitude?: number;
    longitude?: number;
    start_time?: string;
    estimated_cost?: number;
    replacement_for_item_id?: number;
  }>;
};

export async function createIncident(
  tripId: number,
  payload: CreateIncidentPayload
): Promise<IncidentResponse> {
  return apiFetch<IncidentResponse>(endpoints.trips.incidents.create(tripId), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function listIncidents(tripId: number): Promise<IncidentResponse[]> {
  return apiFetch<IncidentResponse[]>(endpoints.trips.incidents.list(tripId));
}

export async function createReplan(
  tripId: number,
  payload: CreateReplanPayload
): Promise<ReplanAggregateResponse> {
  return apiFetch<ReplanAggregateResponse>(endpoints.trips.replans.create(tripId), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getReplanDetail(
  tripId: number,
  sessionId: number
): Promise<ReplanAggregateResponse> {
  return apiFetch<ReplanAggregateResponse>(endpoints.trips.replans.detail(tripId, sessionId));
}
