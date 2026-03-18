import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';

type ConfirmRecommendTripSaveResponse = {
  trip_id: number;
};

export async function confirmRecommendTripSave(
  recommendationId: number | string,
  tripId: number | string
): Promise<ConfirmRecommendTripSaveResponse> {
  return apiFetch<ConfirmRecommendTripSaveResponse>(endpoints.recommendations.confirmSave(recommendationId, tripId), {
    method: 'POST',
  });
}
