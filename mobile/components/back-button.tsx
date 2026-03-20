import { MaterialIcons } from '@expo/vector-icons';
import { useRouter } from 'expo-router';
import { Pressable, StyleSheet } from 'react-native';

type BackButtonProps = {
  onPress?: () => void;
  size?: number;
};

export function BackButton({ onPress, size = 24 }: BackButtonProps) {
  const router = useRouter();

  return (
    <Pressable style={styles.button} onPress={onPress ?? (() => router.back())}>
      <MaterialIcons name="chevron-left" size={size} color="#94A3B8" />
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    width: 36,
    height: 36,
    alignItems: 'center',
    justifyContent: 'center',
  },
});
