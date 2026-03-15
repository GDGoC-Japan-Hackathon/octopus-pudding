import { Stack } from 'expo-router';

export default function MypageTabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" options={{ title: 'マイページ' }} />
      <Stack.Screen name="friends" options={{ title: 'フレンド一覧' }} />
      <Stack.Screen name="history" options={{ title: '旅行履歴' }} />
      <Stack.Screen name="settings" options={{ title: '設定' }} />
      <Stack.Screen name="detail" options={{ title: '詳細' }} />
    </Stack>
  );
}
