import { type TripResponse } from '@/features/trips/types/trip-edit';
import { type TripListFilters, type TripListItemViewModel } from '@/features/trips/types/trip-list';

function parseCategories(value?: string[] | null): string[] {
  return value?.filter(Boolean) ?? [];
}

export function parseTripDateValue(value: string): number | null {
  const normalized = value.replace(/\./g, '/').replace(/-/g, '/');
  const match = normalized.match(/^(\d{4})\/(\d{1,2})\/(\d{1,2})$/);
  if (!match) return null;
  const [, year, month, day] = match;
  const parsed = new Date(Number(year), Number(month) - 1, Number(day)).getTime();
  return Number.isNaN(parsed) ? null : parsed;
}

export function formatTripStatusLabel(status: string) {
  if (status === 'planned') return '保存済み';
  if (status === 'ongoing') return '進行中';
  if (status === 'completed') return '完了';
  return status;
}

export function toTripListItemViewModel(plan: TripResponse): TripListItemViewModel {
  const statusLabel = formatTripStatusLabel(plan.status);
  const categories = parseCategories(plan.recommendation_categories);

  return {
    id: plan.id,
    title: `${plan.origin} → ${plan.destination}`,
    statusLabel,
    statusVariant: plan.status === 'planned' ? 'planned' : 'muted',
    dateLabel: `${plan.start_date} - ${plan.end_date}`,
    participantCount: plan.participant_count,
    peopleLabel: `${plan.participant_count}名`,
    categories,
    searchableText: [plan.origin, plan.destination, statusLabel, `${plan.participant_count}名`, ...categories]
      .join(' ')
      .toLowerCase(),
    startDateValue: parseTripDateValue(plan.start_date),
    endDateValue: parseTripDateValue(plan.end_date),
    createdAtValue: plan.created_at ? new Date(plan.created_at).getTime() : null,
  };
}

export function filterTripListItems(items: TripListItemViewModel[], filters: TripListFilters) {
  const query = filters.keyword.trim().toLowerCase();
  const startFilterValue = filters.startDate ? parseTripDateValue(filters.startDate) : null;
  const endFilterValue = filters.endDate ? parseTripDateValue(filters.endDate) : null;
  const selectedCategories = filters.categories ?? [];

  const filtered = items.filter((item) => {
    const matchesKeyword = query.length === 0 || item.searchableText.includes(query);
    const matchesStart =
      startFilterValue === null || (item.startDateValue !== null && item.startDateValue >= startFilterValue);
    const matchesEnd =
      endFilterValue === null || (item.endDateValue !== null && item.endDateValue <= endFilterValue);
    const matchesPeople =
      !(filters as TripListFilters & { participantCount?: number | null }).participantCount ||
      item.participantCount === (filters as TripListFilters & { participantCount?: number | null }).participantCount;
    const matchesCategories =
      selectedCategories.length === 0 || selectedCategories.every((category) => item.categories.includes(category));

    return matchesKeyword && matchesStart && matchesEnd && matchesPeople && matchesCategories;
  });

  return filtered.sort((a, b) => {
    const aDate = a.createdAtValue ?? 0;
    const bDate = b.createdAtValue ?? 0;
    return filters.sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
  });
}
