import { Stack } from 'expo-router';

export default function HomeTabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" options={{ title: 'ホーム' }} />
      <Stack.Screen name="traveling" options={{ title: '旅行中' }} />
    </Stack>
  );
}
