import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

type CloneMode = 'use' | 'customize';

type CloneRecommendTripResponse = {
  trip_id: number;
};

export async function cloneRecommendTrip(
  recommendationId: number | string,
  mode: CloneMode
): Promise<CloneRecommendTripResponse> {
  return apiFetch<CloneRecommendTripResponse>(endpoints.recommendations.clone(recommendationId), {
    method: 'POST',
    body: JSON.stringify({ mode }),
  });
}
