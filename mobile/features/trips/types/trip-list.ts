import { type TripStatus } from '@/features/trips/types/trip-status';

export type TripSortOrder = 'newest' | 'oldest';

export type TripListFilters = {
  keyword: string;
  startDate: string;
  endDate: string;
  sortOrder: TripSortOrder;
  participantCount?: number | null;
  categories?: string[];
};

export type TripListItemViewModel = {
  id: number;
  title: string;
  status: TripStatus;
  statusLabel: string;
  statusVariant: 'planned' | 'ongoing' | 'muted';
  dateLabel: string;
  participantCount: number;
  peopleLabel: string;
  categories: string[];
  searchableText: string;
  startDateValue: number | null;
  endDateValue: number | null;
  createdAtValue: number | null;
};
