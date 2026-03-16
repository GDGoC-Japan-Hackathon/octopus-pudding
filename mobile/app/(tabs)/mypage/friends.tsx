import { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, Text, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';

import { getFriends } from '@/features/friends/api/get-friends';
import { type FriendResponse } from '@/features/friends/types/friend-request';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { ListButton } from '@/features/travel/components/ListButton';
import { travelStyles } from '@/features/travel/styles';

export default function FriendsListScreen() {
  const [friends, setFriends] = useState<FriendResponse[]>([]);
  const [isLoading, setIsLoading] = useState(true);

  const loadFriends = useCallback(async () => {
    setIsLoading(true);
    try {
      const list = await getFriends();
      setFriends(list);
    } catch {
      Alert.alert('取得失敗', 'フレンド一覧の取得に失敗しました。時間をおいて再度お試しください。');
      setFriends([]);
    } finally {
      setIsLoading(false);
    }
  }, []);

  useFocusEffect(
    useCallback(() => {
      void loadFriends();
    }, [loadFriends])
  );

  return (
    <View style={travelStyles.screen}>
      <AppHeader title="フレンド一覧" showWeather={false} />
      <View style={travelStyles.container}>
        {isLoading ? (
          <View style={{ paddingVertical: 24, alignItems: 'center', gap: 10 }}>
            <ActivityIndicator size="small" color="#F97316" />
            <Text style={{ fontSize: 13, color: '#64748B' }}>フレンド一覧を取得中です...</Text>
          </View>
        ) : null}
        <FlatList
          data={isLoading ? [] : friends}
          keyExtractor={(item) => String(item.user.id)}
          renderItem={({ item }) => (
            <ListButton
              title={item.user.username}
              description={`ID: ${item.user.id} ／ 最寄り駅: ${item.user.nearest_station ?? '未設定'}`}
              href={{
                pathname: '/mypage/detail',
                params: {
                  section: 'friends',
                  id: String(item.user.id),
                  name: item.user.username,
                  nearestStation: item.user.nearest_station ?? '',
                  addedAt: item.created_at ?? '',
                },
              }}
            />
          )}
          ListEmptyComponent={
            !isLoading ? (
              <View style={travelStyles.detailSection}>
                <Text style={{ fontSize: 16, fontWeight: '700', color: '#0F172A' }}>
                  フレンドがまだいません
                </Text>
                <Text style={{ fontSize: 13, color: '#64748B' }}>
                  フレンド申請を承認するとここに表示されます。
                </Text>
              </View>
            ) : null
          }
          ItemSeparatorComponent={() => null}
        />
      </View>
    </View>
  );
}
