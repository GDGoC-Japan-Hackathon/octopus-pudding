import { Stack } from 'expo-router';

export default function CreateTabLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
      }}>
      <Stack.Screen name="index" options={{ title: '作成方法選択' }} />
      <Stack.Screen name="new-plan" options={{ title: '新規プラン作成' }} />
      <Stack.Screen name="generating" options={{ title: 'プラン生成中' }} />
      <Stack.Screen name="edit" options={{ title: 'プラン編集' }} />
      <Stack.Screen name="replanning" options={{ title: 'トラブルによる再計画' }} />
    </Stack>
  );
}
