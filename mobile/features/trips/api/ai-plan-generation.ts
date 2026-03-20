import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import {
  type AiPlanGenerationResponse,
  type CreateAiPlanGenerationRequest,
} from '@/features/trips/types/ai-plan-generation';

export async function createAiPlanGeneration(
  tripId: number,
  payload: CreateAiPlanGenerationRequest
): Promise<AiPlanGenerationResponse> {
  return apiFetch<AiPlanGenerationResponse>(endpoints.trips.aiPlanGenerations.create(tripId), {
    method: 'POST',
    body: JSON.stringify(payload),
  });
}

export async function getAiPlanGeneration(
  tripId: number,
  generationId: number
): Promise<AiPlanGenerationResponse> {
  return apiFetch<AiPlanGenerationResponse>(endpoints.trips.aiPlanGenerations.detail(tripId, generationId));
}
