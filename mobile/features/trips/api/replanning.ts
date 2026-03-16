import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import {
  type CreateIncidentPayload,
  type CreateReplanPayload,
  type IncidentResponse,
  type ReplanAggregateResponse,
} from '@/features/trips/types/replanning';

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
