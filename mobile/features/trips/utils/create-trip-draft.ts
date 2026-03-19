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
};

type CreateTripDraft = {
  formValues: CreateTripFormValues;
  selectedCompanionUserIds: number[];
};

let createTripDraft: CreateTripDraft = {
  formValues: defaultCreateTripFormValues,
  selectedCompanionUserIds: [],
};

export function getCreateTripDraft(): CreateTripDraft {
  return {
    formValues: {
      ...createTripDraft.formValues,
      recommendationCategories: [...createTripDraft.formValues.recommendationCategories],
      transportTypes: [...createTripDraft.formValues.transportTypes],
    },
    selectedCompanionUserIds: [...createTripDraft.selectedCompanionUserIds],
  };
}

export function setCreateTripDraft(nextDraft: Partial<CreateTripDraft>) {
  createTripDraft = {
    formValues: nextDraft.formValues
      ? {
          ...nextDraft.formValues,
          recommendationCategories: [...nextDraft.formValues.recommendationCategories],
          transportTypes: [...nextDraft.formValues.transportTypes],
        }
      : createTripDraft.formValues,
    selectedCompanionUserIds: nextDraft.selectedCompanionUserIds
      ? [...nextDraft.selectedCompanionUserIds]
      : createTripDraft.selectedCompanionUserIds,
  };
}

export function clearCreateTripDraft() {
  createTripDraft = {
    formValues: defaultCreateTripFormValues,
    selectedCompanionUserIds: [],
  };
}
