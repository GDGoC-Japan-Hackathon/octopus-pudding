import { useCallback, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { BackButton } from '@/components/back-button';
import { getIncomingFriendRequests } from '@/features/friends/api/get-incoming-friend-requests';
import { updateFriendRequestStatus } from '@/features/friends/api/update-friend-request-status';
import {
  type FriendRequestDecisionStatus,
  type FriendRequestResponse,
} from '@/features/friends/types/friend-request';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
import { ApiError } from '@/lib/api/client';
import { weatherMock } from '@/data/travel';

export default function FriendRequestsScreen() {
  const [requests, setRequests] = useState<FriendRequestResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);
  const [processingRequestId, setProcessingRequestId] = useState<number | null>(null);

  const pendingRequests = useMemo(() => requests.filter((request) => request.status === 'pending'), [requests]);

  const loadIncomingRequests = useCallback(async () => {
    setIsLoading(true);
    try {
      const incoming = await getIncomingFriendRequests();
      setRequests(incoming);
    } catch {
      Alert.alert('取得失敗', 'フレンド申請の取得に失敗しました。時間をおいて再度お試しください。');
      setRequests([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadIncomingRequests();
    }, [loadIncomingRequests])
  );

  const handleUpdateRequest = useCallback(
    async (requestId: number, status: FriendRequestDecisionStatus) => {
      if (processingRequestId !== null) {
        return;
      }

      setProcessingRequestId(requestId);
      try {
        await updateFriendRequestStatus(requestId, status);
        setRequests((prev) => prev.filter((request) => request.id !== requestId));
      } catch (error) {
        if (error instanceof ApiError) {
          if (error.status === 401) {
            Alert.alert('認証エラー', 'セッションが切れました。再ログインしてください。');
          } else if (error.status === 403) {
            Alert.alert('権限エラー', 'この申請を更新する権限がありません。');
          } else if (error.status === 404) {
            Alert.alert('更新失敗', '対象の申請が見つかりませんでした。');
          } else if (error.status === 409) {
            Alert.alert('更新失敗', 'この申請はすでに処理済みです。');
          } else {
            Alert.alert('更新失敗', `申請の更新に失敗しました (${error.status})`);
          }
        } else {
          Alert.alert('更新失敗', '通信エラーが発生しました。時間をおいて再度お試しください。');
        }
        await loadIncomingRequests();
      } finally {
        setProcessingRequestId(null);
      }
    },
    [loadIncomingRequests, processingRequestId]
  );

  return (
    <View style={travelStyles.screen}>
      <AppHeader title="受信フレンド申請" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />
      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <BackButton />

        {isLoading ? (
          <View style={styles.centerWrap}>
            <ActivityIndicator size="small" color="#F97316" />
            <Text style={styles.helperText}>フレンド申請を取得中です...</Text>
          </View>
        ) : null}

        {!isLoading && pendingRequests.length === 0 ? (
          <View style={travelStyles.detailSection}>
            <Text style={styles.emptyTitle}>受信中のフレンド申請はありません</Text>
            <Text style={styles.helperText}>新しい申請が届くとここに表示されます。</Text>
          </View>
        ) : null}

        {!isLoading
          ? pendingRequests.map((request) => {
              const requester = request.requester;
              const isProcessing = processingRequestId === request.id;

              return (
                <View key={request.id} style={travelStyles.detailSection}>
                  <Text style={styles.sectionHeader}>申請者</Text>
                  <Text style={styles.userName}>{requester?.username ?? '不明なユーザー'}</Text>
                  <Text style={styles.userMeta}>ID: {requester?.id ?? request.requester_user_id}</Text>
                  <Text style={styles.userMeta}>
                    最寄り駅: {requester?.nearest_station && requester.nearest_station.length > 0 ? requester.nearest_station : '未設定'}
                  </Text>
                  <View style={styles.actions}>
                    <Pressable
                      style={[styles.actionButton, styles.rejectButton, isProcessing && styles.disabledButton]}
                      onPress={() => void handleUpdateRequest(request.id, 'rejected')}
                      disabled={isProcessing}
                    >
                      <Text style={[styles.actionButtonText, styles.rejectButtonText]}>拒否</Text>
                    </Pressable>
                    <Pressable
                      style={[styles.actionButton, styles.acceptButton, isProcessing && styles.disabledButton]}
                      onPress={() => void handleUpdateRequest(request.id, 'accepted')}
                      disabled={isProcessing}
                    >
                      {isProcessing ? (
                        <ActivityIndicator size="small" color="#FFFFFF" />
                      ) : (
                        <Text style={styles.actionButtonText}>承認</Text>
                      )}
                    </Pressable>
                  </View>
                </View>
              );
            })
          : null}
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  scrollView: {
    flex: 1,
  },
  content: {
    ...travelStyles.container,
    gap: 12,
  },
  centerWrap: {
    paddingVertical: 24,
    alignItems: 'center',
    gap: 10,
  },
  helperText: {
    fontSize: 13,
    color: '#64748B',
  },
  emptyTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
  },
  sectionHeader: {
    fontSize: 13,
    fontWeight: '700',
    color: '#64748B',
  },
  userName: {
    fontSize: 20,
    fontWeight: '700',
    color: '#0F172A',
  },
  userMeta: {
    fontSize: 13,
    color: '#334155',
  },
  actions: {
    flexDirection: 'row',
    justifyContent: 'flex-end',
    gap: 8,
    marginTop: 6,
  },
  actionButton: {
    minWidth: 88,
    height: 38,
    borderRadius: 10,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 14,
  },
  actionButtonText: {
    color: '#FFFFFF',
    fontSize: 13,
    fontWeight: '700',
  },
  acceptButton: {
    backgroundColor: '#16A34A',
  },
  rejectButton: {
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#CBD5E1',
  },
  rejectButtonText: {
    color: '#334155',
  },
  disabledButton: {
    opacity: 0.65,
  },
});
