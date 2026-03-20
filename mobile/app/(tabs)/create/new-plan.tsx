import { TripPlanForm, type TripPlanFormSubmitPayload } from '@/features/trips/components/TripPlanForm';
import { validateAndBuildCreateTripPayload } from '@/features/trips/utils/create-trip';
import {
  clearCreateTripDraft,
  getCreateTripDraft,
  setCreateTripDraft,
} from '@/features/trips/utils/create-trip-draft';
import { useRouter } from 'expo-router';
import { Alert } from 'react-native';

export default function CreateNewPlanScreen() {
  const router = useRouter();
  const draft = getCreateTripDraft();

  async function handleSubmit({
    formValues,
    selectedCompanionUserIds,
  }: TripPlanFormSubmitPayload) {
    const validation = validateAndBuildCreateTripPayload(formValues);
    if (!validation.ok) {
      Alert.alert('入力エラー', validation.message);
      return;
    }

    setCreateTripDraft({
      formValues,
      selectedCompanionUserIds,
    });
    router.push('/create/generating');
  }

  return (
    <TripPlanForm
      title="新規プラン作成"
      submitLabel="AIにプランを作ってもらう"
      initialFormValues={draft.formValues}
      initialSelectedCompanionUserIds={draft.selectedCompanionUserIds}
      onBack={() => {
        clearCreateTripDraft();
        router.replace('/create');
      }}
      onSubmit={handleSubmit}
    />
  );
}
