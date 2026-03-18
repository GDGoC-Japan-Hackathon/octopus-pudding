import { type PlanDetailTimelineItem } from '@/features/plan-detail/types';

export type RecommendCategory = 'すべて' | 'カフェ' | '夜景' | 'グルメ' | '温泉';

export type RecommendPlanListItem = {
  id: string;
  title: string;
  location: string;
  author: string;
  saveCount: number;
  isSavedByMe: boolean;
  savedTripId?: string | null;
  image: string;
  category: string;
};

export type RecommendPlanDetailDay = {
  key: string;
  label: string;
  timeline: PlanDetailTimelineItem[];
};

export type RecommendPlanDetail = {
  id: string;
  title: string;
  image: string;
  username: string;
  date: string;
  area: string;
  intro: string;
  budget: string;
  moveTime: string;
  isSavedByMe: boolean;
  savedTripId?: string | null;
  days: RecommendPlanDetailDay[];
};
