import {
  type RecommendListFilters,
  type RecommendPlanListItem,
  type RecommendPlanListItemViewModel,
} from '@/features/recommend/types';

export function parseRecommendDateValue(value: string): number | null {
  if (!value) return null;
  const normalized = value.replace(/\./g, '/').replace(/-/g, '/');
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const yearNum = Number(year);
  const monthNum = Number(month);
  const dayNum = Number(day);
  const parsed = new Date(yearNum, monthNum - 1, dayNum);
  if (Number.isNaN(parsed.getTime())) return null;
  if (
    parsed.getFullYear() !== yearNum ||
    parsed.getMonth() + 1 !== monthNum ||
    parsed.getDate() !== dayNum
  ) {
    return null;
  }
  return parsed.getTime();
}

function parseRecommendCreatedAtValue(value?: string | null): number | null {
  if (!value) return null;
  const parsed = new Date(value).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

function formatRecommendCreatedLabel(value?: string | null) {
  const timestamp = parseRecommendCreatedAtValue(value);
  if (timestamp === null) {
    return null;
  }
  const parsed = new Date(timestamp);
  return `作成日 ${parsed.getFullYear()}/${String(parsed.getMonth() + 1).padStart(2, '0')}/${String(parsed.getDate()).padStart(2, '0')}`;
}

export function getRecommendDurationDays(startDate: string, endDate: string) {
  const start = parseRecommendDateValue(startDate);
  const end = parseRecommendDateValue(endDate);
  if (start === null || end === null || end < start) {
    return null;
  }
  const msPerDay = 1000 * 60 * 60 * 24;
  return Math.floor((end - start) / msPerDay) + 1;
}

function compareRecommendIdAsc(aId: string, bId: string) {
  const aNumber = Number(aId);
  const bNumber = Number(bId);

  if (Number.isInteger(aNumber) && Number.isInteger(bNumber)) {
    return aNumber - bNumber;
  }

  return aId.localeCompare(bId, undefined, { numeric: true });
}

function compareRecommendIdDesc(aId: string, bId: string) {
  return compareRecommendIdAsc(bId, aId);
}

export function toRecommendPlanListItemViewModel(plan: RecommendPlanListItem): RecommendPlanListItemViewModel {
  const createdAtValue = parseRecommendCreatedAtValue(plan.createdAt);
  return {
    ...plan,
    createdLabel: formatRecommendCreatedLabel(plan.createdAt),
    searchableText: [plan.title, plan.peopleLabel, ...plan.categories].join(' ').toLowerCase(),
    durationDays: getRecommendDurationDays(plan.startDate, plan.endDate),
    createdAtValue,
  };
}

export function toRecommendPlanListItemViewModels(plans: RecommendPlanListItem[]) {
  return plans.map(toRecommendPlanListItemViewModel);
}

export function filterRecommendPlans(
  items: RecommendPlanListItemViewModel[],
  filters: RecommendListFilters
) {
  const query = filters.keyword.trim().toLowerCase();
  const selectedCategories = filters.categories ?? [];

  const filtered = items.filter((item) => {
    const matchesKeyword = query.length === 0 || item.searchableText.includes(query);
    const matchesPeople = !filters.participantCount || item.participantCount === filters.participantCount;
    const matchesCategories =
      selectedCategories.length === 0 || selectedCategories.every((category) => item.categories.includes(category));
    const matchesDuration =
      filters.durationDays === null ||
      filters.durationDays === undefined ||
      item.durationDays === filters.durationDays;

    return matchesKeyword && matchesPeople && matchesCategories && matchesDuration;
  });

  return filtered.sort((a, b) => {
    if (filters.sortOrder === 'popular') {
      const bySaveCount = b.saveCount - a.saveCount;
      if (bySaveCount !== 0) {
        return bySaveCount;
      }
      const byCreatedAt = (b.createdAtValue ?? 0) - (a.createdAtValue ?? 0);
      if (byCreatedAt !== 0) {
        return byCreatedAt;
      }
      return compareRecommendIdDesc(a.id, b.id);
    }

    const aDate = a.createdAtValue ?? 0;
    const bDate = b.createdAtValue ?? 0;
    if (filters.sortOrder === 'newest') {
      if (bDate !== aDate) {
        return bDate - aDate;
      }
      return compareRecommendIdDesc(a.id, b.id);
    }

    if (aDate !== bDate) {
      return aDate - bDate;
    }
    return compareRecommendIdAsc(a.id, b.id);
  });
}

export function pickHomeRecommendPlans(items: RecommendPlanListItemViewModel[], limit = 3) {
  return items
    .slice()
    .sort((a, b) => {
      const bySaveCount = b.saveCount - a.saveCount;
      if (bySaveCount !== 0) {
        return bySaveCount;
      }
      const byCreatedAt = (b.createdAtValue ?? 0) - (a.createdAtValue ?? 0);
      if (byCreatedAt !== 0) {
        return byCreatedAt;
      }
      return compareRecommendIdDesc(a.id, b.id);
    })
    .slice(0, limit);
}
