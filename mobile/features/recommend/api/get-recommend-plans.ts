import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type RecommendPlanListItem } from '@/features/recommend/types';

type RecommendPlanListItemResponse = {
  id: number | string;
  title: string;
  start_date?: string;
  startDate?: string;
  end_date?: string;
  endDate?: string;
  date_label?: string;
  dateLabel?: string;
  participant_count?: number;
  participantCount?: number;
  save_count?: number;
  saveCount?: number;
  created_at?: string | null;
  createdAt?: string | null;
  is_saved_by_me?: boolean;
  isSavedByMe?: boolean;
  saved_trip_id?: number | string | null;
  savedTripId?: number | string | null;
  image: string;
  categories: string[];
};

export async function getRecommendPlans(): Promise<RecommendPlanListItem[]> {
  const plans = await apiFetch<RecommendPlanListItemResponse[]>(endpoints.recommendations.list);
  return plans.map((plan) => ({
    id: String(plan.id),
    title: plan.title,
    startDate: plan.startDate ?? plan.start_date ?? '',
    endDate: plan.endDate ?? plan.end_date ?? '',
    dateLabel: plan.dateLabel ?? plan.date_label ?? '',
    participantCount: plan.participantCount ?? plan.participant_count ?? 0,
    peopleLabel: `${plan.participantCount ?? plan.participant_count ?? 0}名`,
    saveCount: plan.saveCount ?? plan.save_count ?? 0,
    createdAt: plan.createdAt ?? plan.created_at ?? null,
    isSavedByMe: plan.isSavedByMe ?? plan.is_saved_by_me ?? false,
    savedTripId:
      plan.savedTripId !== undefined && plan.savedTripId !== null
        ? String(plan.savedTripId)
        : plan.saved_trip_id !== undefined && plan.saved_trip_id !== null
          ? String(plan.saved_trip_id)
          : null,
    categories: plan.categories,
    image: plan.image,
  }));
}
