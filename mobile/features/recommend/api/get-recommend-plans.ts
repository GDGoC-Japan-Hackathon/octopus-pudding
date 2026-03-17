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
    image: plan.image,
    category: plan.category,
  }));
}
