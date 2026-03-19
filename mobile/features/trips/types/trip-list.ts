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
  statusLabel: string;
  statusVariant: 'planned' | 'muted';
  dateLabel: string;
  participantCount: number;
  peopleLabel: string;
  categories: string[];
  searchableText: string;
  startDateValue: number | null;
  endDateValue: number | null;
  createdAtValue: number | null;
};
