import { useEffect, useMemo, useState } from 'react';
import { ActivityIndicator, Alert, Pressable, ScrollView, StyleSheet, Text, TextInput, View } from 'react-native';

import { BackButton } from '@/components/back-button';
import { updateMe } from '@/features/auth/api/update-me';
import { AppHeader } from '@/features/travel/components/AppHeader';
import { travelStyles } from '@/features/travel/styles';
import { weatherMock } from '@/data/travel';
import { useAuth } from '@/features/auth/hooks/use-auth';
import { ApiError } from '@/lib/api/client';

export default function SettingsScreen() {
  const { backendUser, setBackendUser, refreshBackendUser } = useAuth();
  const [username, setUsername] = useState('');
  const [nearestStation, setNearestStation] = useState('');
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (!backendUser) {
      return;
    }
    setUsername(backendUser.username ?? '');
    setNearestStation(backendUser.nearest_station ?? '');
  }, [backendUser]);

  const isSaveDisabled = useMemo(() => {
    if (!backendUser || isSaving) {
      return true;
    }
    const hasNoDiff =
      username === (backendUser.username ?? '') &&
      nearestStation === (backendUser.nearest_station ?? '');
    return hasNoDiff;
  }, [backendUser, isSaving, nearestStation, username]);

  const handleSave = async () => {
    if (!backendUser || isSaving) {
      return;
    }

    const trimmedUsername = username.trim();
    if (!trimmedUsername) {
      Alert.alert('入力エラー', 'ユーザー名は必須です。');
      return;
    }

    setIsSaving(true);
    try {
      const updated = await updateMe({
        username: trimmedUsername,
        nearest_station: nearestStation.trim() || null,
      });
      setBackendUser(updated);
      Alert.alert('更新完了', '設定を保存しました。');
    } catch (error) {
      if (error instanceof ApiError) {
        if (error.status === 422) {
          Alert.alert('入力エラー', '入力内容が不正です。');
        } else {
          Alert.alert('保存失敗', `設定の保存に失敗しました (${error.status})`);
        }
      } else {
        Alert.alert('保存失敗', '設定の保存に失敗しました。時間をおいて再度お試しください。');
      }
      await refreshBackendUser();
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <View style={travelStyles.screen}>
      <AppHeader title="設定" weatherLabel={`${weatherMock.temp} ${weatherMock.condition}`} />

      <ScrollView style={styles.scrollView} contentContainerStyle={styles.content}>
        <BackButton />

        <View style={styles.card}>
          <Text style={styles.sectionTitle}>アカウント情報</Text>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>メールアドレス（編集不可）</Text>
            <TextInput
              value={backendUser?.email ?? ''}
              editable={false}
              style={[styles.input, styles.inputDisabled]}
              placeholder="メールアドレス"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>ユーザー名</Text>
            <TextInput
              value={username}
              onChangeText={setUsername}
              style={styles.input}
              placeholder="ユーザー名を入力"
              placeholderTextColor="#94A3B8"
            />
          </View>

          <View style={styles.inputGroup}>
            <Text style={styles.label}>最寄り駅</Text>
            <TextInput
              value={nearestStation}
              onChangeText={setNearestStation}
              style={styles.input}
              placeholder="例: 新宿駅"
              placeholderTextColor="#94A3B8"
            />
          </View>

        </View>

        <Pressable
          style={[styles.saveButton, isSaveDisabled && styles.saveButtonDisabled]}
          onPress={handleSave}
          disabled={isSaveDisabled}
        >
          {isSaving ? (
            <ActivityIndicator size="small" color="#FFFFFF" />
          ) : (
            <Text style={styles.saveButtonText}>保存する</Text>
          )}
        </Pressable>
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
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E5E7EB',
    padding: 16,
    gap: 12,
  },
  sectionTitle: {
    fontSize: 16,
    fontWeight: '700',
    color: '#0F172A',
    marginBottom: 4,
  },
  inputGroup: {
    gap: 6,
  },
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: '#475569',
  },
  input: {
    height: 44,
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 12,
    backgroundColor: '#FFFFFF',
    color: '#0F172A',
    fontSize: 14,
  },
  inputDisabled: {
    backgroundColor: '#F8FAFC',
    color: '#64748B',
  },
  saveButton: {
    height: 46,
    borderRadius: 12,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
  },
  saveButtonDisabled: {
    backgroundColor: '#FDBA74',
  },
  saveButtonText: {
    color: '#FFFFFF',
    fontWeight: '700',
    fontSize: 15,
  },
});
