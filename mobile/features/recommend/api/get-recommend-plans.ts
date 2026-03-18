import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type RecommendPlanListItem } from '@/features/recommend/types';

function parseCategories(value: string): string[] {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

type RecommendPlanListItemResponse = {
  id: number | string;
  title: string;
  date_label?: string;
  dateLabel?: string;
  participant_count?: number;
  participantCount?: number;
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
    dateLabel: plan.dateLabel ?? plan.date_label ?? '',
    participantCount: plan.participantCount ?? plan.participant_count ?? 0,
    peopleLabel: `${plan.participantCount ?? plan.participant_count ?? 0}名`,
    saveCount: plan.saveCount ?? plan.save_count ?? 0,
    isSavedByMe: plan.isSavedByMe ?? plan.is_saved_by_me ?? false,
    savedTripId:
      plan.savedTripId !== undefined && plan.savedTripId !== null
        ? String(plan.savedTripId)
        : plan.saved_trip_id !== undefined && plan.saved_trip_id !== null
          ? String(plan.saved_trip_id)
          : null,
    categories: parseCategories(plan.category),
    image: plan.image,
  }));
}
