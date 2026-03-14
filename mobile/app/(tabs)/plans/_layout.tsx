import { Stack } from 'expo-router';

export default function PlansTabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" options={{ title: '作成済みの計画一覧' }} />
      <Stack.Screen name="detail" options={{ title: '作成済みの計画詳細' }} />
    </Stack>
  );
}
