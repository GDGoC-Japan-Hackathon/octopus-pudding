import { apiFetch } from '@/lib/api/client';
import { endpoints } from '@/lib/api/endpoints';
import { type RecommendPlanDetail } from '@/features/recommend/types';

type RecommendPlanDetailResponse = {
  id: number | string;
  title: string;
  image: string;
  username: string;
  date: string;
  area: string;
  intro: string;
  budget: string;
  move_time?: string;
  moveTime?: string;
  days: RecommendPlanDetail['days'];
};

export async function getRecommendPlanDetail(id: string): Promise<RecommendPlanDetail | null> {
  const plan = await apiFetch<RecommendPlanDetailResponse>(endpoints.recommendations.detail(id));
  return {
    id: String(plan.id),
    title: plan.title,
    image: plan.image,
    username: plan.username,
    date: plan.date,
    area: plan.area,
    intro: plan.intro,
    budget: plan.budget,
    moveTime: plan.moveTime ?? plan.move_time ?? '',
    days: plan.days,
  };
}
