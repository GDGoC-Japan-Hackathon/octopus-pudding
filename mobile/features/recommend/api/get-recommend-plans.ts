import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type RecommendPlanListItem } from '@/features/recommend/types';

type RecommendPlanListItemResponse = {
  id: number | string;
  title: string;
  location: string;
  author: string;
  save_count?: number;
  saveCount?: number;
  is_saved_by_me?: boolean;
  isSavedByMe?: boolean;
  saved_trip_id?: number | string | null;
  savedTripId?: number | string | null;
  image: string;
  category: string;
};

export async function getRecommendPlans(): Promise<RecommendPlanListItem[]> {
  const plans = await apiFetch<RecommendPlanListItemResponse[]>(endpoints.recommendations.list);
  return plans.map((plan) => ({
    id: String(plan.id),
    title: plan.title,
    location: plan.location,
    author: plan.author,
    saveCount: plan.saveCount ?? plan.save_count ?? 0,
    isSavedByMe: plan.isSavedByMe ?? plan.is_saved_by_me ?? false,
    savedTripId:
      plan.savedTripId !== undefined && plan.savedTripId !== null
        ? String(plan.savedTripId)
        : plan.saved_trip_id !== undefined && plan.saved_trip_id !== null
          ? String(plan.saved_trip_id)
          : null,
    image: plan.image,
    category: plan.category,
  }));
}
