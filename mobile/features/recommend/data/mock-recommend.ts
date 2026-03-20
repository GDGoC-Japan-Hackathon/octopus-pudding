import { recommendedPlans } from '@/data/travel';
import { recommendPlanDetails } from '@/features/plan-detail/data/recommend-plan-detail';
import { type RecommendPlanDetail, type RecommendPlanListItem } from '@/features/recommend/types';

export function getMockRecommendPlans(): RecommendPlanListItem[] {
  return recommendedPlans.map((plan) => ({
    id: plan.id,
    title: plan.title,
    dateLabel: plan.location,
    saveCount: plan.likes,
    image: plan.image,
    categories: [plan.category],
  }));
}

export function getMockRecommendPlanDetail(id: string): RecommendPlanDetail | null {
  const plan = recommendedPlans.find((item) => item.id === id);
  const meta = recommendPlanDetails[id];

  if (!plan || !meta) {
    return null;
  }

  return {
    id: plan.id,
    title: plan.title,
    image: plan.image,
    username: meta.username,
    createdAt: null,
    startDate: '',
    endDate: '',
    area: meta.area,
    comment: meta.intro,
    budget: meta.budget,
    moveTime: meta.moveTime,
    isSavedByMe: false,
    days: meta.days.map((day) => ({
      key: day.key,
      label: day.label,
      timeline: day.timeline,
    })),
  };
}
