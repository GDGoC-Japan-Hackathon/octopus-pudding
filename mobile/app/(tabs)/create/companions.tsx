import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { weatherMock } from '@/data/travel';
import { getFriends } from '@/features/friends/api/get-friends';
import { type FriendResponse } from '@/features/friends/types/friend-request';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
import {
  getCreateTripDraft,
  setCreateTripDraft,
} from '@/features/trips/utils/create-trip-draft';

export default function CreateCompanionsScreen() {
  const router = useRouter();
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [selectedUserIds, setSelectedUserIds] = useState<Set<number>>(() => new Set(getCreateTripDraft().selectedCompanionUserIds));
  const [isLoading, setIsLoading] = useState(true);
  const draft = useMemo(() => getCreateTripDraft(), []);
  const headerBackSlot = (
    <Pressable style={styles.headerBackButton} onPress={() => router.back()}>
      <MaterialIcons name="arrow-back" size={16} color="#EC5B13" />
      <Text style={styles.headerBackButtonText}>戻る</Text>
    </Pressable>
  );

  const participantCount = useMemo(() => {
    const parsed = Number(draft.formValues.participantCount);
    return Number.isInteger(parsed) && parsed > 0 ? parsed : 1;
  }, [draft.formValues.participantCount]);

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
      if (maxSelectableCompanions > 0 && next.size >= maxSelectableCompanions) {
        Alert.alert('選択上限', `同行者は最大${maxSelectableCompanions}人まで選択できます。`);
        return prev;
      }
      next.add(userId);
      return next;
    });
  };

  const handleComplete = () => {
    setCreateTripDraft({
      selectedCompanionUserIds: Array.from(selectedUserIds),
    });
    router.back();
  };

  return (
    <ScrollView style={travelStyles.screen} contentContainerStyle={{ paddingBottom: 24 }}>
      <AppHeader
        title="同行者の選択"
        weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`}
        leftSlot={headerBackSlot}
      />

      <View style={travelStyles.container}>
        <Text style={styles.sectionTitle}>プランを共有する同行者を選択</Text>
        <Text style={styles.sectionHint}>選択後は基本情報の入力に戻ります。選択しなくても作成できます。</Text>

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
          style={travelStyles.primaryButton}
          onPress={handleComplete}
        >
          <Text style={travelStyles.primaryButtonText}>選択を完了する</Text>
        </Pressable>
      </View>
    </ScrollView>
  );
}

const styles = StyleSheet.create({
  headerBackButton: {
    minHeight: 32,
    paddingHorizontal: 10,
    borderRadius: 999,
    borderWidth: 1,
    borderColor: '#FED7AA',
    backgroundColor: '#FFF7ED',
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 4,
  },
  headerBackButtonText: {
    fontSize: 12,
    fontWeight: '700',
    color: '#EC5B13',
  },
  sectionTitle: {
    marginBottom: 8,
    fontSize: 20,
    fontWeight: '800',
    color: '#0F172A',
  },
  sectionHint: {
    marginBottom: 16,
    fontSize: 13,
    color: '#64748B',
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
});
