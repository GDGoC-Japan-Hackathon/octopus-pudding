import { toTimeLabel } from '@/features/plan-detail/utils/plan-detail';
import { type TripDetailAggregateResponse, type TripDetailItineraryItemResponse } from '@/features/trips/types/trip-detail';
import { type TripResponse } from '@/features/trips/types/trip-edit';

export type HomeTimelineItem = {
  id: number;
  time: string;
  title: string;
  detail: string;
  metaLabel?: string | null;
  itemType: 'place' | 'transport';
  transportMode?: string | null;
};

export type HomeOngoingTripView = {
  dayLabel: string | null;
  sectionTitle: '現在の行程' | '次の予定' | '本日の行程';
  primaryLabel: '現在' | 'まもなく' | '終了';
  primaryItem: HomeTimelineItem | null;
  secondaryLabel: 'このあと' | null;
  secondaryItem: HomeTimelineItem | null;
  helperText: string | null;
  hasTimeline: boolean;
};

type HomeDayGroup = {
  tripDayId: number;
  dayNumber?: number;
  date?: string | null;
  items: TripDetailItineraryItemResponse[];
};

function parseTimestamp(value?: string | null): number | null {
  if (!value) {
    return null;
  }

  const timestamp = new Date(value).getTime();
  return Number.isNaN(timestamp) ? null : timestamp;
}

function toLocalDateKey(date = new Date()) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

function normalizeDate(value?: string | null) {
  if (!value) {
    return null;
  }

  const normalized = value.slice(0, 10).replace(/\//g, '-');
  return /^\d{4}-\d{2}-\d{2}$/.test(normalized) ? normalized : null;
}

function compareUpdatedAtDesc(a: TripResponse, b: TripResponse) {
  const aUpdatedAt = parseTimestamp(a.updated_at) ?? Number.NEGATIVE_INFINITY;
  const bUpdatedAt = parseTimestamp(b.updated_at) ?? Number.NEGATIVE_INFINITY;

  if (aUpdatedAt !== bUpdatedAt) {
    return bUpdatedAt - aUpdatedAt;
  }

  return b.id - a.id;
}

function transportModeLabel(mode?: string | null) {
  if (mode === 'WALK') return '徒歩で移動';
  if (mode === 'BUS') return 'バスで移動';
  return '電車で移動';
}

function buildTransportMetaLabel(item: TripDetailItineraryItemResponse) {
  const parts: string[] = [];

  if (typeof item.travel_minutes === 'number') {
    parts.push(`${item.travel_minutes}分`);
  }
  if (typeof item.distance_meters === 'number') {
    parts.push(
      item.distance_meters >= 1000
        ? `${(item.distance_meters / 1000).toFixed(1)}km`
        : `${item.distance_meters}m`
    );
  }

  if (parts.length) {
    return parts.join(' / ');
  }

  return item.notes || null;
}

function toTimelineTitle(item: TripDetailItineraryItemResponse) {
  if (item.item_type === 'transport') {
    return item.name || transportModeLabel(item.transport_mode);
  }

  return item.name;
}

function toTimelineDetail(item: TripDetailItineraryItemResponse) {
  if (item.item_type === 'transport' && item.from_name && item.to_name) {
    return `${item.from_name} → ${item.to_name}`;
  }

  return item.notes || item.category || '詳細メモは未設定です。';
}

function toHomeTimelineItem(item?: TripDetailItineraryItemResponse | null): HomeTimelineItem | null {
  if (!item) {
    return null;
  }

  return {
    id: item.id,
    time: toTimeLabel(item.start_time),
    title: toTimelineTitle(item),
    detail: toTimelineDetail(item),
    metaLabel: item.item_type === 'transport' ? buildTransportMetaLabel(item) : null,
    itemType: item.item_type === 'transport' ? 'transport' : 'place',
    transportMode: item.transport_mode,
  };
}

function compareNullableNumberAsc(a: number | null, b: number | null) {
  if (a === b) {
    return 0;
  }
  if (a === null) {
    return 1;
  }
  if (b === null) {
    return -1;
  }
  return a - b;
}

function compareHomeDayGroups(a: HomeDayGroup, b: HomeDayGroup) {
  const dayNumberComparison = compareNullableNumberAsc(a.dayNumber ?? null, b.dayNumber ?? null);
  if (dayNumberComparison !== 0) {
    return dayNumberComparison;
  }

  const dateComparison = (normalizeDate(a.date) ?? '').localeCompare(normalizeDate(b.date) ?? '');
  if (dateComparison !== 0) {
    return dateComparison;
  }

  return a.tripDayId - b.tripDayId;
}

function buildHomeDayGroups(aggregate: TripDetailAggregateResponse): HomeDayGroup[] {
  const groups = new Map<number, HomeDayGroup>();

  for (const day of aggregate.days) {
    groups.set(day.id, {
      tripDayId: day.id,
      dayNumber: day.day_number,
      date: day.date,
      items: [],
    });
  }

  for (const item of aggregate.itinerary_items) {
    const existing = groups.get(item.trip_day_id);
    if (existing) {
      existing.items.push(item);
      continue;
    }

    groups.set(item.trip_day_id, {
      tripDayId: item.trip_day_id,
      items: [item],
    });
  }

  return Array.from(groups.values())
    .sort(compareHomeDayGroups)
    .map((group) => ({
      ...group,
      items: group.items.slice().sort((a, b) => (a.start_time ?? '').localeCompare(b.start_time ?? '')),
    }));
}

function getDateDistance(dateValue: string | null | undefined, now: number) {
  const normalized = normalizeDate(dateValue);
  if (!normalized) {
    return Number.POSITIVE_INFINITY;
  }

  const distance = new Date(`${normalized}T00:00:00`).getTime();
  return Number.isNaN(distance) ? Number.POSITIVE_INFINITY : Math.abs(distance - now);
}

function getItemDistance(item: TripDetailItineraryItemResponse, now: number) {
  const start = parseTimestamp(item.start_time);
  const end = parseTimestamp(item.end_time);

  if (start !== null && end !== null && start <= now && now < end) {
    return 0;
  }

  const candidates = [start, end].filter((value): value is number => value !== null);
  if (!candidates.length) {
    return Number.POSITIVE_INFINITY;
  }

  return Math.min(...candidates.map((value) => Math.abs(value - now)));
}

function selectActiveGroup(groups: HomeDayGroup[], nowDate = new Date()) {
  const todayKey = toLocalDateKey(nowDate);
  const todayGroup = groups.find((group) => normalizeDate(group.date) === todayKey);

  if (todayGroup) {
    return todayGroup;
  }

  const now = nowDate.getTime();

  return (
    [...groups].sort((a, b) => {
      const aDistance = Math.min(
        getDateDistance(a.date, now),
        ...a.items.map((item) => getItemDistance(item, now))
      );
      const bDistance = Math.min(
        getDateDistance(b.date, now),
        ...b.items.map((item) => getItemDistance(item, now))
      );

      if (aDistance !== bDistance) {
        return aDistance - bDistance;
      }

      return compareHomeDayGroups(a, b);
    })[0] ?? null
  );
}

function resolveTimelineItems(
  items: TripDetailItineraryItemResponse[]
): Omit<HomeOngoingTripView, 'dayLabel'> {
  if (!items.length) {
    return {
      sectionTitle: '本日の行程',
      primaryLabel: 'まもなく',
      primaryItem: null,
      secondaryLabel: null,
      secondaryItem: null,
      helperText: null,
      hasTimeline: false,
    };
  }

  const now = Date.now();
  const currentIndex = items.findIndex((item) => {
    const start = parseTimestamp(item.start_time);
    const end = parseTimestamp(item.end_time);

    if (start === null || end === null) {
      return false;
    }

    return start <= now && now < end;
  });

  if (currentIndex >= 0) {
    return {
      sectionTitle: '現在の行程',
      primaryLabel: '現在',
      primaryItem: toHomeTimelineItem(items[currentIndex]),
      secondaryLabel: items[currentIndex + 1] ? 'このあと' : null,
      secondaryItem: toHomeTimelineItem(items[currentIndex + 1]),
      helperText: null,
      hasTimeline: true,
    };
  }

  let nextIndex = 0;
  for (let index = items.length - 1; index >= 0; index -= 1) {
    const start = parseTimestamp(items[index].start_time);
    const end = parseTimestamp(items[index].end_time);

    if (end !== null && end <= now) {
      nextIndex = index + 1;
      break;
    }

    if (end === null && start !== null && start <= now) {
      nextIndex = index + 1;
      break;
    }
  }

  if (nextIndex < items.length) {
    return {
      sectionTitle: '次の予定',
      primaryLabel: 'まもなく',
      primaryItem: toHomeTimelineItem(items[nextIndex]),
      secondaryLabel: items[nextIndex + 1] ? 'このあと' : null,
      secondaryItem: toHomeTimelineItem(items[nextIndex + 1]),
      helperText: null,
      hasTimeline: true,
    };
  }

  return {
    sectionTitle: '本日の行程',
    primaryLabel: '終了',
    primaryItem: toHomeTimelineItem(items[items.length - 1]),
    secondaryLabel: null,
    secondaryItem: null,
    helperText: '本日の行程は終了しました。',
    hasTimeline: true,
  };
}

export function selectFeaturedOngoingTrip(trips: TripResponse[]): TripResponse | null {
  const ongoingTrips = trips.filter((trip) => trip.status === 'ongoing');
  if (!ongoingTrips.length) {
    return null;
  }

  return [...ongoingTrips].sort(compareUpdatedAtDesc)[0] ?? null;
}

export function buildHomeOngoingTripView(aggregate: TripDetailAggregateResponse): HomeOngoingTripView {
  const groups = buildHomeDayGroups(aggregate);
  const activeGroup = selectActiveGroup(groups);

  if (!activeGroup) {
    return {
      dayLabel: null,
      sectionTitle: '本日の行程',
      primaryLabel: 'まもなく',
      primaryItem: null,
      secondaryLabel: null,
      secondaryItem: null,
      helperText: null,
      hasTimeline: false,
    };
  }

  const resolvedTimeline = resolveTimelineItems(activeGroup.items);
  const formattedDate = normalizeDate(activeGroup.date)?.replace(/-/g, '/');
  const dayLabel = activeGroup.dayNumber ? `Day ${activeGroup.dayNumber}` : 'Day 1';

  return {
    dayLabel: formattedDate ? `${dayLabel} ・ ${formattedDate}` : dayLabel,
    ...resolvedTimeline,
  };
}
