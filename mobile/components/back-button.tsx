import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet, Text } from 'react-native';

type BackButtonProps = {
  label?: string;
  onPress?: () => void;
};

export function BackButton({ label = '戻る', onPress }: BackButtonProps) {
  const router = useRouter();

  return (
    <Pressable style={styles.button} onPress={onPress ?? (() => router.back())}>
      <MaterialIcons name="arrow-back-ios-new" size={16} color="#334155" />
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    height: 36,
    alignSelf: 'flex-start',
    borderRadius: 10,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    paddingHorizontal: 10,
    backgroundColor: '#FFFFFF',
    flexDirection: 'row',
    alignItems: 'center',
    gap: 4,
  },
  label: {
    color: '#334155',
    fontSize: 13,
    fontWeight: '700',
  },
});
