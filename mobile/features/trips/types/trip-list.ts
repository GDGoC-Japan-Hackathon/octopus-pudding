export type TripSortOrder = 'newest' | 'oldest';

export type TripListFilters = {
  keyword: string;
  startDate: string;
  endDate: string;
  sortOrder: TripSortOrder;
};

export type TripListItemViewModel = {
  id: number;
  title: string;
  statusLabel: string;
  statusVariant: 'planned' | 'muted';
  dateLabel: string;
  peopleLabel: string;
  searchableText: string;
  startDateValue: number | null;
};
