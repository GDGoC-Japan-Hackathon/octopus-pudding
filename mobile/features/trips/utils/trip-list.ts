import { type TripResponse } from '@/features/trips/types/trip-edit';
import { type TripListFilters, type TripListItemViewModel } from '@/features/trips/types/trip-list';

function parseCategories(value?: string[] | null): string[] {
  return value?.filter(Boolean) ?? [];
}

export function parseTripDateValue(value: string): number | null {
  const normalized = value.replace(/\./g, '/').replace(/-/g, '/');
  const parsed = new Date(normalized).getTime();
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
  };
}

export function filterTripListItems(items: TripListItemViewModel[], filters: TripListFilters) {
  const query = filters.keyword.trim().toLowerCase();
  const startFilterValue = filters.startDate ? parseTripDateValue(filters.startDate) : null;
  const endFilterValue = filters.endDate ? parseTripDateValue(filters.endDate) : null;

  const filtered = items.filter((item) => {
    const matchesKeyword = query.length === 0 || item.searchableText.includes(query);
    const matchesStart =
      startFilterValue === null || (item.startDateValue !== null && item.startDateValue >= startFilterValue);
    const matchesEnd =
      endFilterValue === null || (item.startDateValue !== null && item.startDateValue <= endFilterValue);
    const matchesPeople =
      !(filters as TripListFilters & { participantCount?: number | null }).participantCount ||
      item.participantCount === (filters as TripListFilters & { participantCount?: number | null }).participantCount;

    return matchesKeyword && matchesStart && matchesEnd && matchesPeople;
  });

  return filtered.sort((a, b) => {
    const aDate = a.startDateValue ?? 0;
    const bDate = b.startDateValue ?? 0;
    return filters.sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
  });
}
