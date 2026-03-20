import { type CreateTripFormValues } from '@/features/trips/utils/create-trip';

export const defaultCreateTripFormValues: CreateTripFormValues = {
  origin: '',
  destination: '',
  startDate: '',
  endDate: '',
  participantCount: '1',
  budget: '10000',
  atmosphere: 'のんびり',
  recommendationCategories: [],
  transportTypes: [],
  mustVisitPlacesText: '',
  accommodationNotesByDay: ['', '', ''],
  additionalRequestComment: '',
};

type CreateTripDraft = {
  formValues: CreateTripFormValues;
  selectedCompanionUserIds: number[];
  selectedCompanionNames: string[];
};

let createTripDraft: CreateTripDraft = {
  formValues: defaultCreateTripFormValues,
  selectedCompanionUserIds: [],
  selectedCompanionNames: [],
};

export function getCreateTripDraft(): CreateTripDraft {
  return {
    formValues: {
      ...createTripDraft.formValues,
      recommendationCategories: [...createTripDraft.formValues.recommendationCategories],
      transportTypes: [...createTripDraft.formValues.transportTypes],
      accommodationNotesByDay: [...createTripDraft.formValues.accommodationNotesByDay],
    },
    selectedCompanionUserIds: [...createTripDraft.selectedCompanionUserIds],
    selectedCompanionNames: [...createTripDraft.selectedCompanionNames],
  };
}

export function setCreateTripDraft(nextDraft: Partial<CreateTripDraft>) {
  createTripDraft = {
    formValues: nextDraft.formValues
      ? {
          ...nextDraft.formValues,
          recommendationCategories: [...nextDraft.formValues.recommendationCategories],
          transportTypes: [...nextDraft.formValues.transportTypes],
          accommodationNotesByDay: [...nextDraft.formValues.accommodationNotesByDay],
        }
      : createTripDraft.formValues,
    selectedCompanionUserIds: nextDraft.selectedCompanionUserIds
      ? [...nextDraft.selectedCompanionUserIds]
      : createTripDraft.selectedCompanionUserIds,
    selectedCompanionNames: nextDraft.selectedCompanionNames
      ? [...nextDraft.selectedCompanionNames]
      : createTripDraft.selectedCompanionNames,
  };
}

export function clearCreateTripDraft() {
  createTripDraft = {
    formValues: defaultCreateTripFormValues,
    selectedCompanionUserIds: [],
    selectedCompanionNames: [],
  };
}
