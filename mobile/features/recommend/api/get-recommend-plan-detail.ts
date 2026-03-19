import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type RecommendPlanDetail } from '@/features/recommend/types';

type RecommendPlanDetailResponse = {
  id: number | string;
  title: string;
  image: string;
  username: string;
  created_at?: string | null;
  createdAt?: string | null;
  start_date: string;
  startDate?: string;
  end_date: string;
  endDate?: string;
  area: string;
  comment: string;
  budget: string;
  move_time?: string;
  moveTime?: string;
  is_saved_by_me?: boolean;
  isSavedByMe?: boolean;
  saved_trip_id?: number | string | null;
  savedTripId?: number | string | null;
  days: RecommendPlanDetail['days'];
};

export async function getRecommendPlanDetail(id: string): Promise<RecommendPlanDetail | null> {
  const plan = await apiFetch<RecommendPlanDetailResponse>(endpoints.recommendations.detail(id));
  return {
    id: String(plan.id),
    title: plan.title,
    image: plan.image,
    username: plan.username,
    createdAt: plan.createdAt ?? plan.created_at ?? null,
    startDate: plan.startDate ?? plan.start_date,
    endDate: plan.endDate ?? plan.end_date,
    area: plan.area,
    comment: plan.comment,
    budget: plan.budget,
    moveTime: plan.moveTime ?? plan.move_time ?? '',
    isSavedByMe: plan.isSavedByMe ?? plan.is_saved_by_me ?? false,
    savedTripId:
      plan.savedTripId !== undefined && plan.savedTripId !== null
        ? String(plan.savedTripId)
        : plan.saved_trip_id !== undefined && plan.saved_trip_id !== null
          ? String(plan.saved_trip_id)
          : null,
    days: plan.days,
  };
}
