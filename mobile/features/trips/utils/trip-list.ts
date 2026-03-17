import { type TripResponse } from '@/features/trips/types/trip-edit';
import { type TripListFilters, type TripListItemViewModel } from '@/features/trips/types/trip-list';

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

  return {
    id: plan.id,
    title: `${plan.origin} → ${plan.destination}`,
    statusLabel,
    statusVariant: plan.status === 'planned' ? 'planned' : 'muted',
    dateLabel: `${plan.start_date} - ${plan.end_date}`,
    peopleLabel: '人数未設定',
    searchableText: [plan.origin, plan.destination, statusLabel].join(' ').toLowerCase(),
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

    return matchesKeyword && matchesStart && matchesEnd;
  });

  return filtered.sort((a, b) => {
    const aDate = a.startDateValue ?? 0;
    const bDate = b.startDateValue ?? 0;
    return filters.sortOrder === 'newest' ? bDate - aDate : aDate - bDate;
  });
}
