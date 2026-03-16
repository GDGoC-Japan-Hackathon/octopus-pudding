import { MaterialIcons } from '@expo/vector-icons';
import * as ImagePicker from 'expo-image-picker';
import { Link } from 'expo-router';
import { useEffect, useState } from 'react';
import { Alert, Image, Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';

import { uploadProfileImage } from '@/features/auth/api/upload-profile-image';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { ApiError } from '@/lib/api/client';
import { travelStyles } from '@/features/travel/styles';
import { weatherMock } from '@/data/travel';
import { useAuth } from '@/features/auth/hooks/use-auth';

export default function MyPageScreen() {
  const { signOut, backendUser, refreshBackendUser } = useAuth();
  const [isAvatarLoadError, setIsAvatarLoadError] = useState(false);
  const [isUploadingImage, setIsUploadingImage] = useState(false);

  const profileImageUrl = backendUser?.profile_image_url ?? null;
  const hasProfileImage = !!profileImageUrl && !isAvatarLoadError;

  useEffect(() => {
    setIsAvatarLoadError(false);
  }, [profileImageUrl]);

  const handleAddFriend = (method: string) => {
    Alert.alert('準備中', `${method} は未実装です`);
  };

  const handleUploadProfileImage = async () => {
    if (isUploadingImage) {
      return;
    }

    const permission = await ImagePicker.requestMediaLibraryPermissionsAsync();
    if (!permission.granted) {
      Alert.alert('権限が必要です', 'プロフィール画像を選択するには写真へのアクセス許可が必要です。');
      return;
    }

    const result = await ImagePicker.launchImageLibraryAsync({
      mediaTypes: ['images'],
      allowsEditing: true,
      aspect: [1, 1],
      quality: 0.8,
    });

    if (result.canceled || result.assets.length === 0) {
      return;
    }

    const asset = result.assets[0];
    if (!asset.uri) {
      Alert.alert('エラー', '画像を取得できませんでした。');
      return;
    }

    setIsUploadingImage(true);
    try {
      await uploadProfileImage({
        uri: asset.uri,
        fileName: asset.fileName,
        mimeType: asset.mimeType,
      });
      await refreshBackendUser();
      Alert.alert('完了', 'プロフィール画像を更新しました。');
    } catch (error) {
      if (error instanceof ApiError) {
        Alert.alert('エラー', `アップロードに失敗しました (${error.status})`);
      } else {
        Alert.alert('エラー', 'アップロードに失敗しました。時間をおいて再度お試しください。');
      }
    } finally {
      setIsUploadingImage(false);
    }
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
            {hasProfileImage ? (
              <Image
                source={{ uri: profileImageUrl }}
                style={styles.avatar}
                onError={() => setIsAvatarLoadError(true)}
              />
            ) : (
              <View style={styles.avatarPlaceholder}>
                <MaterialIcons name="person" size={44} color="#94A3B8" />
              </View>
            )}
            <Pressable
              style={styles.editIcon}
              onPress={handleUploadProfileImage}
              disabled={isUploadingImage}
            >
              <MaterialIcons name={isUploadingImage ? 'hourglass-empty' : 'edit'} size={16} color="#FFFFFF" />
            </Pressable>
          </View>
          <Text style={styles.profileName}>{backendUser?.username ?? 'ユーザー'}</Text>
          <Text style={styles.idText}>ID: {backendUser?.id ?? '-'}</Text>
          <View style={styles.locationRow}>
            <MaterialIcons name="location-on" size={16} color="#64748B" />
            <Text style={styles.locationText}>
              最寄り駅: {backendUser?.nearest_station || '未設定'}
            </Text>
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
  avatarPlaceholder: {
    width: 86,
    height: 86,
    borderRadius: 43,
    backgroundColor: '#F8FAFC',
    alignItems: 'center',
    justifyContent: 'center',
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
