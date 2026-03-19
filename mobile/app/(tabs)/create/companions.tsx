import { useLocalSearchParams, useNavigation, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { weatherMock } from '@/data/travel';
import { getFriends } from '@/features/friends/api/get-friends';
import { type FriendResponse } from '@/features/friends/types/friend-request';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
import { createAiPlanGeneration } from '@/features/trips/api/ai-plan-generation';
import { createTrip } from '@/features/trips/api/create-trip';
import { addTripMember } from '@/features/trips/api/trip-members';
import {
  type CreateTripFormValues,
  validateAndBuildCreateTripPayload,
} from '@/features/trips/utils/create-trip';

function getStringParam(value: string | string[] | undefined) {
  return Array.isArray(value) ? value[0] ?? '' : value ?? '';
}

function parseCategories(value: string) {
  return value
    .split(',')
    .map((item) => item.trim())
    .filter(Boolean);
}

export default function CreateCompanionsScreen() {
  const router = useRouter();
  const navigation = useNavigation();
  const params = useLocalSearchParams();
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(new Set());
  const [isLoading, setIsLoading] = useState(true);
  const [isSubmitting, setIsSubmitting] = useState(false);

  const formValues = useMemo<CreateTripFormValues>(
    () => ({
      origin: getStringParam(params.origin),
      destination: getStringParam(params.destination),
      startDate: getStringParam(params.startDate),
      endDate: getStringParam(params.endDate),
      participantCount: getStringParam(params.participantCount),
      budget: getStringParam(params.budget),
      atmosphere: getStringParam(params.atmosphere),
      recommendationCategories: parseCategories(getStringParam(params.recommendationCategories)),
      transportTypes: [],
    }),
    [params]
  );

  const participantCount = useMemo(() => {
    const parsed = Number(formValues.participantCount);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  }, [formValues.participantCount]);

  const maxSelectableCompanions = Math.max(0, participantCount - 1);

  useEffect(() => {
    const run = async () => {
      try {
        setIsLoading(true);
        const list = await getFriends();
        setFriends(list);
      } catch {
        Alert.alert('取得失敗', '友達一覧の取得に失敗しました。');
        setFriends([]);
      } finally {
        setIsLoading(false);
      }
    };
    void run();
  }, []);

  useEffect(() => {
    const unsubscribe = navigation.addListener('beforeRemove', (event) => {
      if (!isSubmitting) {
        return;
      }
      event.preventDefault();
      Alert.alert('プラン作成中', 'AIでプランを作成中です。完了するまでこの画面から移動できません。');
    });

    return unsubscribe;
  }, [isSubmitting, navigation]);

  const toggleFriend = (userId: number) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        return next;
      }
      next.add(userId);
      return next;
    });
  };

  const handleCreate = async () => {
    const validated = validateAndBuildCreateTripPayload(formValues);
    if (!validated.ok) {
      Alert.alert('入力エラー', validated.message);
      return;
    }

    setIsSubmitting(true);
    try {
      const created = await createTrip(validated.payload);

      // 同行者の追加は部分的な失敗を許容し、プラン作成成功とは分けて扱う
      const memberPromises = Array.from(selectedUserIds).map((userId) =>
        addTripMember(created.trip.id, userId),
      );

      const results = await Promise.allSettled(memberPromises);
      const hasMemberError = results.some((result) => result.status === 'rejected');
      const aiGeneration = await createAiPlanGeneration(created.trip.id, { run_async: false });

      if (aiGeneration.status === 'failed') {
        Alert.alert(
          'プラン作成完了',
          aiGeneration.error_message ?? 'プランは作成されましたが、AIで日程を生成できませんでした。詳細画面から再度お試しください。',
        );
      } else if (hasMemberError) {
        Alert.alert(
          'プラン作成完了',
          'プランは作成されましたが、一部の同行者を追加できませんでした。プラン詳細画面から再度追加をお試しください。',
        );
      }

      router.replace({
        pathname: '/plans/detail',
        params: { id: String(created.trip.id) },
      });
    } catch {
      // createTrip 自体が失敗した場合のみ「プラン作成に失敗」と表示
      Alert.alert('作成失敗', 'プラン作成に失敗しました。ログイン状態やAPI接続を確認してください。');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <ScrollView style={travelStyles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <AppHeader
        title="同行者の選択"
        weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`}
        leftSlot={isSubmitting ? undefined : <BackButton />}
      />

      <View style={travelStyles.container}>
        <Text style={styles.sectionTitle}>プランを共有する同行者を選択</Text>

        {isLoading ? (
          <View style={styles.loadingWrap}>
            <ActivityIndicator color="#F97316" />
          </View>
        ) : null}

        {!isLoading && friends.length === 0 ? (
          <View style={styles.emptyCard}>
            <Text style={styles.emptyText}>共有できる友達がまだいません。</Text>
          </View>
        ) : null}

        {!isLoading &&
          friends.map((friend) => {
            const selected = selectedUserIds.has(friend.user.id);
            return (
              <Pressable
                key={friend.user.id}
                style={[styles.friendCard, selected && styles.friendCardSelected]}
                onPress={() => toggleFriend(friend.user.id)}
              >
                <View style={styles.friendInfo}>
                  <Text style={styles.friendName}>{friend.user.username}</Text>
                  <Text style={styles.friendMeta}>{friend.user.email}</Text>
                </View>
                <View style={[styles.checkbox, selected && styles.checkboxSelected]} />
              </Pressable>
            );
          })}

        <Pressable
          style={[travelStyles.primaryButton, isSubmitting && styles.buttonDisabled]}
          onPress={handleCreate}
          disabled={isSubmitting}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={travelStyles.primaryButtonText}>プランを作成する</Text>
          )}
        </Pressable>

        {isSubmitting ? (
          <Text style={styles.submittingHint}>AIでプランを作成中です。完了するまで移動できません。</Text>
        ) : null}
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  sectionTitle: {
    marginBottom: 16,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  loadingWrap: {
    paddingVertical: 24,
    alignItems: 'center',
  },
  emptyCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    padding: 16,
    marginBottom: 16,
  },
  emptyText: {
    fontSize: 14,
    color: '#64748B',
  },
  friendCard: {
    borderWidth: 1,
    borderColor: '#E2E8F0',
    borderRadius: 16,
    backgroundColor: '#FFFFFF',
    paddingHorizontal: 16,
    paddingVertical: 14,
    marginBottom: 12,
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
  },
  friendCardSelected: {
    borderColor: '#FDBA74',
    backgroundColor: '#FFF7ED',
  },
  friendInfo: {
    flex: 1,
    gap: 2,
  },
  friendName: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  friendMeta: {
    fontSize: 13,
    color: '#64748B',
  },
  checkbox: {
    width: 22,
    height: 22,
    borderRadius: 11,
    borderWidth: 2,
    borderColor: '#CBD5E1',
    backgroundColor: '#FFFFFF',
  },
  checkboxSelected: {
    borderColor: '#F97316',
    backgroundColor: '#F97316',
  },
  buttonDisabled: {
    opacity: 0.6,
  },
  submittingHint: {
    marginTop: 12,
    fontSize: 13,
    fontWeight: '600',
    color: '#64748B',
    textAlign: 'center',
  },
});
