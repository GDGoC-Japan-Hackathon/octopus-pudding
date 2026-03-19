import { MaterialIcons } from '@expo/vector-icons';
import { useNavigation, useRouter } from 'expo-router';
import { useEffect, useRef, useState } from 'react';
import { ActivityIndicator, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { weatherMock } from '@/data/travel';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
import { createAiPlanGeneration } from '@/features/trips/api/ai-plan-generation';
import { createTrip } from '@/features/trips/api/create-trip';
import { addTripMember } from '@/features/trips/api/trip-members';
import { clearCreateTripDraft, getCreateTripDraft } from '@/features/trips/utils/create-trip-draft';
import { validateAndBuildCreateTripPayload } from '@/features/trips/utils/create-trip';

type GenerationState = 'creating' | 'completed' | 'failed';
type StepState = 'pending' | 'active' | 'done' | 'failed';

function getAiGenerationFailureMessage(errorMessage?: string | null) {
  if (!errorMessage) {
    return 'プランは作成されましたが、AIで日程を生成できませんでした。少し時間をおいて再度お試しください。';
  }

  if (errorMessage.includes('Gemini API error: 429') || errorMessage.includes('RESOURCE_EXHAUSTED')) {
    return 'プランは作成されましたが、AI生成が混み合っています。少し待ってからもう一度お試しください。';
  }

  return 'プランは作成されましたが、AIで日程を生成できませんでした。詳細画面から再度お試しください。';
}

function StepRow({
  title,
  description,
  state,
}: {
  title: string;
  description: string;
  state: StepState;
}) {
  const iconName =
    state === 'done' ? 'check-circle' : state === 'failed' ? 'error' : state === 'active' ? 'autorenew' : 'radio-button-unchecked';
  const iconColor =
    state === 'done' ? '#16A34A' : state === 'failed' ? '#DC2626' : state === 'active' ? '#F97316' : '#94A3B8';

  return (
    <View style={styles.stepRow}>
      <MaterialIcons name={iconName} size={20} color={iconColor} />
      <View style={styles.stepBody}>
        <Text style={styles.stepTitle}>{title}</Text>
        <Text style={styles.stepDescription}>{description}</Text>
      </View>
    </View>
  );
}

export default function CreateGeneratingScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const startedRef = useRef(false);
  const [generationState, setGenerationState] = useState<GenerationState>('creating');
  const [tripId, setTripId] = useState<number | null>(null);
  const [resultMessage, setResultMessage] = useState('旅程を作成しています。しばらくお待ちください。');
  const [tripStepState, setTripStepState] = useState<StepState>('active');
  const [memberStepState, setMemberStepState] = useState<StepState>('pending');
  const [aiStepState, setAiStepState] = useState<StepState>('pending');

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (generationState !== 'creating') {
        return;
      }
      event.preventDefault();
    });

    return unsubscribe;
  }, [generationState, navigation]);

  useEffect(() => {
    if (startedRef.current) {
      return;
    }
    startedRef.current = true;

    const run = async () => {
      const draft = getCreateTripDraft();
      const validated = validateAndBuildCreateTripPayload(draft.formValues);
      if (!validated.ok) {
        setGenerationState('failed');
        setTripStepState('failed');
        setResultMessage(validated.message);
        return;
      }

      try {
        const created = await createTrip(validated.payload);
        setTripId(created.trip.id);
        setTripStepState('done');

        setMemberStepState('active');
        const memberPromises = draft.selectedCompanionUserIds.map((userId) => addTripMember(created.trip.id, userId));
        const memberResults = await Promise.allSettled(memberPromises);
        const hasMemberError = memberResults.some((entry) => entry.status === 'rejected');
        setMemberStepState(hasMemberError ? 'failed' : 'done');

        setAiStepState('active');
        const aiGeneration = await createAiPlanGeneration(created.trip.id, { run_async: false });
        setAiStepState(aiGeneration.status === 'failed' ? 'failed' : 'done');

        clearCreateTripDraft();
        setGenerationState('completed');

        if (aiGeneration.status === 'failed') {
          setResultMessage(getAiGenerationFailureMessage(aiGeneration.error_message));
        } else if (hasMemberError) {
          setResultMessage('プランは作成できましたが、一部の同行者追加に失敗しました。詳細画面から再度追加できます。');
        } else {
          setResultMessage('第一案のプランを作成しました。マイプラン詳細から確認できます。');
        }
      } catch {
        setGenerationState('failed');
        setTripStepState('failed');
        setMemberStepState('pending');
        setAiStepState('pending');
        setResultMessage('プラン作成に失敗しました。入力内容や接続状況を確認して再度お試しください。');
      }
    };

    void run();
  }, []);

  return (
    <View style={travelStyles.screen}>
      <AppHeader title="プランを生成中" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <ScrollView contentContainerStyle={styles.contentContainer}>
        <View style={styles.heroCard}>
          {generationState === 'creating' ? (
            <ActivityIndicator size="large" color="#F97316" />
          ) : generationState === 'completed' ? (
            <MaterialIcons name="check-circle" size={44} color="#16A34A" />
          ) : (
            <MaterialIcons name="error" size={44} color="#DC2626" />
          )}
          <Text style={styles.heroTitle}>
            {generationState === 'creating' ? 'プランを作成しています' : generationState === 'completed' ? '作成が完了しました' : '作成に失敗しました'}
          </Text>
          <Text style={styles.heroBody}>{resultMessage}</Text>
        </View>

        <View style={styles.stepCard}>
          <Text style={styles.stepCardTitle}>進行状況</Text>
          <StepRow title="基本情報を保存" description="旅の基本情報を登録しています。" state={tripStepState} />
          <StepRow title="同行者を反映" description="選択済みの同行者をプランへ追加します。" state={memberStepState} />
          <StepRow title="旅程の第一案を生成" description="AIでタイムラインの第一案を組み立てています。" state={aiStepState} />
        </View>

        {generationState === 'completed' && tripId !== null ? (
          <Pressable
            style={travelStyles.primaryButton}
            onPress={() =>
              router.replace({
                pathname: '/plans/detail',
                params: { id: String(tripId) },
              })
            }
          >
            <Text style={travelStyles.primaryButtonText}>マイプランを見る</Text>
          </Pressable>
        ) : null}

        {generationState === 'failed' ? (
          <Pressable style={styles.secondaryButton} onPress={() => router.back()}>
            <Text style={styles.secondaryButtonText}>基本情報の入力に戻る</Text>
          </Pressable>
        ) : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  contentContainer: {
    padding: 16,
    gap: 16,
    paddingBottom: 28,
  },
  heroCard: {
    borderRadius: 20,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    padding: 24,
    alignItems: 'center',
    gap: 12,
  },
  heroTitle: {
    fontSize: 22,
    fontWeight: '800',
    color: '#0F172A',
    textAlign: 'center',
  },
  heroBody: {
    fontSize: 14,
    lineHeight: 22,
    color: '#64748B',
    textAlign: 'center',
  },
  stepCard: {
    borderRadius: 18,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 14,
  },
  stepCardTitle: {
    fontSize: 16,
    fontWeight: '800',
    color: '#0F172A',
  },
  stepRow: {
    flexDirection: 'row',
    alignItems: 'flex-start',
    gap: 12,
  },
  stepBody: {
    flex: 1,
    gap: 2,
  },
  stepTitle: {
    fontSize: 14,
    fontWeight: '700',
    color: '#0F172A',
  },
  stepDescription: {
    fontSize: 12,
    lineHeight: 18,
    color: '#64748B',
  },
  secondaryButton: {
    borderRadius: 12,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    backgroundColor: '#FFFFFF',
    paddingVertical: 12,
    paddingHorizontal: 16,
    alignItems: 'center',
  },
  secondaryButtonText: {
    fontSize: 14,
    fontWeight: '700',
    color: '#334155',
  },
});
