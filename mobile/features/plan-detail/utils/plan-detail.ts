import {
  type TripDetailAggregateResponse,
  type TripDetailItineraryItemResponse,
} from '@/features/trips/types/trip-detail';
import { getApiErrorMessage } from '@/lib/api/client';

import { type PlanDetailDay, type PlanDetailTimelineItem, type PlanDetailViewModel } from '@/features/plan-detail/types';

export function parseTripId(rawTripId?: string): number | null {
  if (!rawTripId) {
    return null;
  }
  const parsed = Number(rawTripId);
  if (!Number.isInteger(parsed) || parsed <= 0) {
    return null;
  }
  return parsed;
}

export function getTripDetailErrorMessage(error: unknown): string {
  return getApiErrorMessage(error, {
    fallback: '計画詳細の取得に失敗しました。',
    unauthorized: '認証が切れています。再ログイン後にお試しください。',
    forbidden: 'この計画を閲覧する権限がありません。',
    notFound: '対象の計画が見つかりませんでした。',
    defaultWithStatus: true,
  });
}

export function getAiGenerationErrorMessage(error: unknown): string {
  return getApiErrorMessage(error, {
    fallback: 'AIプラン構築の実行に失敗しました。',
    unauthorized: '認証が切れています。再ログイン後にお試しください。',
    forbidden: 'この計画でAIプランを作成する権限がありません。',
    notFound: '対象の計画が見つかりませんでした。',
    defaultWithStatus: true,
  });
}

export function toDurationLabel(start?: string | null, end?: string | null) {
  if (!start || !end) {
    return '時間未設定';
  }
  const startDate = new Date(start);
  const endDate = new Date(end);
  if (Number.isNaN(startDate.getTime()) || Number.isNaN(endDate.getTime())) {
    return '時間未設定';
  }
  const minutes = Math.max(0, Math.round((endDate.getTime() - startDate.getTime()) / 60000));
  const hour = Math.floor(minutes / 60);
  const minute = minutes % 60;
  if (hour === 0) {
    return `${minute}m`;
  }
  return `${hour}h ${minute}m`;
}

export function toTimeLabel(value?: string | null) {
  if (!value) {
    return '--:--';
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return '--:--';
  }
  return `${String(date.getHours()).padStart(2, '0')}:${String(date.getMinutes()).padStart(2, '0')}`;
}

export function budgetLabel(aggregate: TripDetailAggregateResponse) {
  const budget = aggregate.preference?.budget;
  if (!budget) {
    return '未設定';
  }
  return `¥${budget.toLocaleString()}`;
}

export function moveTimeLabel(items: TripDetailItineraryItemResponse[]) {
  if (!items.length) {
    return '未設定';
  }
  const first = items[0];
  const last = items[items.length - 1];
  if (!first.start_time || !last.end_time) {
    return `${items.length}件`;
  }
  return toDurationLabel(first.start_time, last.end_time);
}

export function statusLabel(status: string) {
  if (status === 'planned') return '保存済み';
  if (status === 'ongoing') return '進行中';
  if (status === 'completed') return '完了';
  return status;
}

export function groupItineraryByDay(aggregate: TripDetailAggregateResponse | null) {
  if (!aggregate) {
    return [];
  }

  const dayMap = new Map<number, { dayNumber?: number; date?: string | null }>();
  for (const day of aggregate.days) {
    dayMap.set(day.id, { dayNumber: day.day_number, date: day.date });
  }

  const groups = new Map<
    number,
    {
      tripDayId: number;
      dayNumber?: number;
      date?: string | null;
      items: TripDetailItineraryItemResponse[];
    }
  >();

  for (const item of aggregate.itinerary_items) {
    const dayInfo = dayMap.get(item.trip_day_id);
    const existing = groups.get(item.trip_day_id);
    if (existing) {
      existing.items.push(item);
    } else {
      groups.set(item.trip_day_id, {
        tripDayId: item.trip_day_id,
        dayNumber: dayInfo?.dayNumber,
        date: dayInfo?.date,
        items: [item],
      });
    }
  }

  return Array.from(groups.values())
    .sort((a, b) => (a.dayNumber ?? 999) - (b.dayNumber ?? 999))
    .map((group) => ({
      ...group,
      items: [...group.items].sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')),
    }));
}

export function toTimelineItems(items: TripDetailItineraryItemResponse[]): PlanDetailTimelineItem[] {
  return items.map((item) => ({
    id: item.id,
    start: toTimeLabel(item.start_time),
    end: toTimeLabel(item.end_time),
    title: item.name,
    body: item.notes || item.category || '詳細メモは未設定です。',
    icon:
      item.category === 'food'
        ? 'restaurant'
        : item.category === 'transport'
          ? 'train'
          : 'place',
  }));
}

export function toPlanDetailViewModel(
  aggregate: TripDetailAggregateResponse,
  activeDayId: number | null
): PlanDetailViewModel {
  const groupedItineraryByDay = groupItineraryByDay(aggregate);
  const activeDay =
    groupedItineraryByDay.find((group) => group.tripDayId === activeDayId) ?? groupedItineraryByDay[0] ?? null;

  const days: PlanDetailDay[] = groupedItineraryByDay.length
    ? groupedItineraryByDay.map((group, index) => ({
        key: String(group.tripDayId),
        label: `Day ${group.dayNumber ?? index + 1}`,
      }))
    : [{ key: 'day1', label: 'Day 1' }];

  return {
    title: `${aggregate.trip.origin} → ${aggregate.trip.destination}`,
    subtitle: `${aggregate.trip.start_date} - ${aggregate.trip.end_date} ・ ${statusLabel(aggregate.trip.status)}`,
    intro: `総人数 ${aggregate.trip.participant_count}名`,
    budgetLabel: budgetLabel(aggregate),
    moveTimeLabel: activeDay ? moveTimeLabel(activeDay.items) : '未設定',
    days,
    activeDayKey: activeDay ? String(activeDay.tripDayId) : 'day1',
    timeline: activeDay ? toTimelineItems(activeDay.items) : [],
  };
}
