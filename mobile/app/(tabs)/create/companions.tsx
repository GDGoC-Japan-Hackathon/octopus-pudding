import { useLocalSearchParams, useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { weatherMock } from '@/data/travel';
import { getFriends } from '@/features/friends/api/get-friends';
import { type FriendResponse } from '@/features/friends/types/friend-request';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
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

  const toggleFriend = (userId: number) => {
    setSelectedUserIds((prev) => {
      const next = new Set(prev);
      if (next.has(userId)) {
        next.delete(userId);
        return next;
      }
      if (next.size >= maxSelectableCompanions) {
        Alert.alert('選択上限', `共有する同行者は最大${maxSelectableCompanions}人です。`);
        return prev;
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

    try {
      setIsSubmitting(true);
      const created = await createTrip(validated.payload);
      for (const userId of selectedUserIds) {
        await addTripMember(created.trip.id, userId);
      }
      Alert.alert('保存完了', '新規プランを作成しました。');
      router.replace({
        pathname: '/plans/detail',
        params: { id: String(created.trip.id) },
      });
    } catch {
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
        leftSlot={<BackButton fallbackHref="/create/new-plan" />}
      />

      <View style={travelStyles.container}>
        <View style={travelStyles.detailSection}>
          <Text style={travelStyles.heading}>共有する同行者を選択</Text>
          <Text style={travelStyles.sectionBody}>
            総人数は {participantCount}人 です。アプリで共有する友達は最大 {maxSelectableCompanions}人 まで選べます。
          </Text>
          <Text style={styles.selectedCount}>選択中 {selectedUserIds.size}人</Text>
        </View>

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
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  selectedCount: {
    marginTop: 8,
    fontSize: 13,
    fontWeight: '700',
    color: '#F97316',
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
});
