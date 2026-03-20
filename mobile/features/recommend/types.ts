import { type PlanDetailTimelineItem } from '@/features/plan-detail/types';

export type RecommendCategory = 'すべて' | 'カフェ' | '夜景' | 'グルメ' | '温泉';
export type RecommendSortOrder = 'newest' | 'oldest' | 'popular';

export type RecommendListFilters = {
  keyword: string;
  sortOrder: RecommendSortOrder;
  participantCount?: number | null;
  durationDays?: number | null;
  categories?: string[];
};

export type RecommendPlanListItem = {
  id: string;
  title: string;
  startDate: string;
  endDate: string;
  dateLabel: string;
  participantCount: number;
  peopleLabel: string;
  saveCount: number;
  isSavedByMe: boolean;
  savedTripId: string | null;
  categories: string[];
  image: string;
  createdAt: string | null;
};

export type RecommendPlanListItemViewModel = RecommendPlanListItem & {
  createdLabel: string | null;
  searchableText: string;
  durationDays: number | null;
  createdAtValue: number | null;
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
  createdAt?: string | null;
  startDate: string;
  endDate: string;
  area: string;
  comment: string;
  budget: string;
  moveTime: string;
  isSavedByMe: boolean;
  savedTripId?: string | null;
  days: RecommendPlanDetailDay[];
};
