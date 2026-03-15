import { MaterialIcons } from '@expo/vector-icons';
import { Link } from 'expo-router';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
import { profileMock, weatherMock } from '@/data/travel';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function MyPageScreen() {
  const { signOut } = useAuth();

  const handleAddFriend = (method: string) => {
    Alert.alert('準備中', `${method} は未実装です`);
  };

  const handleLogoutPress = () => {
    Alert.alert('ログアウト確認', 'ログアウトしますか？', [
      { text: 'キャンセル', style: 'cancel' },
      {
        text: 'ログアウト',
        style: 'destructive',
        onPress: async () => {
          try {
            await signOut();
          } catch {
            Alert.alert('エラー', 'ログアウトに失敗しました。再度お試しください。');
          }
        },
      },
    ]);
  };

  return (
    <View style={travelStyles.screen}>
      <AppHeader title="マイページ" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={styles.content}
        showsVerticalScrollIndicator={false}
      >
        <View style={styles.profileSection}>
          <View style={styles.avatarWrap}>
            <Image
              source={{ uri: 'https://i.pravatar.cc/200?img=12' }}
              style={styles.avatar}
            />
            <Pressable
              style={styles.editIcon}
              onPress={() => handleAddFriend('プロフィール編集')}
            >
              <MaterialIcons name="edit" size={16} color="#FFFFFF" />
            </Pressable>
          </View>
          <Text style={styles.profileName}>{profileMock.name}</Text>
          <Text style={styles.idText}>ID: {profileMock.id}</Text>
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={16} color="#64748B" />
            <Text style={styles.locationText}>最寄り駅: {profileMock.nearestStation}</Text>
          </View>
        </View>

        <View style={travelStyles.detailSection}>
          <Text style={styles.sectionHeader}>フレンド追加</Text>
          <View style={styles.friendActions}>
            <Pressable style={styles.actionCard} onPress={() => handleAddFriend('ID検索')}>
              <MaterialIcons name="person-search" size={20} color="#F97316" />
              <Text style={styles.actionText}>ID検索</Text>
            </Pressable>
            <Pressable style={styles.actionCard} onPress={() => handleAddFriend('QRコード')}>
              <MaterialIcons name="qr-code-2" size={20} color="#F97316" />
              <Text style={styles.actionText}>QRコード</Text>
            </Pressable>
          </View>
        </View>

        <View style={travelStyles.detailSection}>
          <Link href="/mypage/friends" asChild>
            <Pressable style={styles.menuRow}>
              <Text style={styles.menuTitle}>フレンド一覧</Text>
              <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
            </Pressable>
          </Link>
          <View style={styles.menuDivider} />
          <Link href="/mypage/history" asChild>
            <Pressable style={styles.menuRow}>
              <Text style={styles.menuTitle}>旅行履歴</Text>
              <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
            </Pressable>
          </Link>
          <View style={styles.menuDivider} />
          <Link href="/mypage/settings" asChild>
            <Pressable style={styles.menuRow}>
              <Text style={styles.menuTitle}>設定</Text>
              <MaterialIcons name="chevron-right" size={20} color="#94A3B8" />
            </Pressable>
          </Link>
          <View style={styles.menuDivider} />
          <Pressable style={styles.menuRow} onPress={handleLogoutPress}>
            <Text style={[styles.menuTitle, styles.logoutText]}>ログアウト</Text>
            <MaterialIcons name="logout" size={18} color="#DC2626" />
          </Pressable>
        </View>
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
    paddingBottom: 24,
    gap: 12,
  },
  profileSection: {
    alignItems: 'center',
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    paddingVertical: 22,
    paddingHorizontal: 16,
    gap: 8,
    marginBottom: 12,
  },
  avatarWrap: {
    width: 94,
    height: 94,
    borderRadius: 47,
    borderWidth: 4,
    borderColor: 'rgba(249,115,22,0.2)',
    alignItems: 'center',
    justifyContent: 'center',
    position: 'relative',
    backgroundColor: '#FFF7ED',
    marginBottom: 8,
  },
  avatar: {
    width: 86,
    height: 86,
    borderRadius: 43,
  },
  editIcon: {
    position: 'absolute',
    right: 0,
    bottom: 2,
    width: 28,
    height: 28,
    borderRadius: 14,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    elevation: 2,
  },
  profileName: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  locationRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  locationText: {
    fontSize: 13,
    color: '#64748B',
  },
  idText: {
    fontSize: 13,
    color: '#64748B',
  },
  sectionHeader: {
    fontSize: 14,
    fontWeight: '700',
    color: '#64748B',
    marginBottom: 8,
  },
  friendActions: {
    flexDirection: 'row',
    gap: 10,
  },
  menuList: {
    borderRadius: 16,
    overflow: 'hidden',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    backgroundColor: '#FFFFFF',
  },
  menuRow: {
    height: 40,
    paddingHorizontal: 16,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 14,
  },
  menuRowFirst: {
    paddingTop: 0,
  },
  menuDivider: {
    height: 1,
    backgroundColor: '#E5E7EB',
  },
  menuIconWrap: {
    width: 20,
    alignItems: 'center',
    justifyContent: 'center',
  },
  menuTitle: {
    flex: 1,
    fontSize: 16,
    color: '#0F172A',
    fontWeight: '500',
  },
  logoutText: {
    color: '#DC2626',
  },
  actionCard: {
    flex: 1,
    minHeight: 76,
    borderRadius: 14,
    backgroundColor: '#FFFFFF',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    padding: 10,
  },
  actionText: {
    color: '#0F172A',
    fontWeight: '700',
  },
});
