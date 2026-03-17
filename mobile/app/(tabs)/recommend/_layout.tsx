import { Stack } from 'expo-router';

export default function RecommendationTabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" options={{ title: 'おすすめ一覧' }} />
      <Stack.Screen name="detail" options={{ title: 'おすすめ詳細' }} />
      <Stack.Screen name="customize" options={{ title: 'おすすめカスタマイズ' }} />
    </Stack>
  );
}
