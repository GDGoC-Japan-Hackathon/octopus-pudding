import { useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/features/auth/hooks/use-auth';

type AuthMode = 'login' | 'signup';

export default function LoginScreen() {
  const { signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [mode, setMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async () => {
    setError(null);
    setIsSubmitting(true);
    console.log('Auth submit pressed', {
      mode,
      email: email.trim(),
      hasPassword: Boolean(password),
    });
    try {
      console.log('[auth] submit start', { mode, email: email.trim() });
      if (mode === 'login') {
        await signIn(email.trim(), password);
      } else {
        await signUp(email.trim(), password);
      }
      console.log('[auth] submit success', { mode, email: email.trim() });
    } catch (error) {
      console.log('[auth] submit error', error);
      const message =
        error instanceof Error
          ? error.message
          : mode === 'login'
            ? 'ログインに失敗しました。メールアドレスまたはパスワードを確認してください。'
            : '新規登録に失敗しました。メール形式やパスワード(6文字以上)を確認してください。';
      setError(message);
    } finally {
      console.log('Auth submit finished');
      setIsSubmitting(false);
    }
  };

  return (
    <View style={styles.screen}>
      <View style={styles.card}>
        <Text style={styles.title}>{mode === 'login' ? 'ログイン' : '新規登録'}</Text>
        <Text style={styles.subtitle}>
          {mode === 'login'
            ? 'Firebase認証でログインします。'
            : 'Firebase認証でアカウントを作成します。'}
        </Text>

        <Text style={styles.label}>メールアドレス</Text>
        <TextInput
          autoCapitalize="none"
          autoCorrect={false}
          keyboardType="email-address"
          value={email}
          onChangeText={setEmail}
          placeholder="you@example.com"
          style={styles.input}
        />

        <Text style={styles.label}>パスワード</Text>
        <TextInput
          secureTextEntry
          value={password}
          onChangeText={setPassword}
          placeholder="********"
          style={styles.input}
        />

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          disabled={isSubmitting || !email || !password}
          style={({ pressed }) => [
            styles.button,
            (isSubmitting || !email || !password) && styles.buttonDisabled,
            pressed && styles.buttonPressed,
          ]}
        >
          {isSubmitting ? (
            <ActivityIndicator color="#FFFFFF" />
          ) : (
            <Text style={styles.buttonText}>{mode === 'login' ? 'ログイン' : '新規登録'}</Text>
          )}
        </Pressable>

        <Pressable
          onPress={() => setMode((prev) => (prev === 'login' ? 'signup' : 'login'))}
          disabled={isSubmitting}
          style={styles.linkButton}
        >
          <Text style={styles.linkButtonText}>
            {mode === 'login'
              ? 'アカウントを作成する'
              : '既存アカウントでログインする'}
          </Text>
        </Pressable>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: '#F8FAFC',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  card: {
    backgroundColor: '#FFFFFF',
    borderRadius: 16,
    borderWidth: 1,
    borderColor: '#E2E8F0',
    padding: 18,
    gap: 10,
  },
  title: {
    fontSize: 24,
    fontWeight: '700',
    color: '#0F172A',
  },
  subtitle: {
    fontSize: 13,
    color: '#64748B',
    marginBottom: 4,
  },
  label: {
    fontSize: 13,
    color: '#334155',
    fontWeight: '600',
  },
  input: {
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    paddingHorizontal: 12,
    paddingVertical: 10,
    backgroundColor: '#FFFFFF',
  },
  button: {
    marginTop: 6,
    borderRadius: 10,
    backgroundColor: '#F97316',
    alignItems: 'center',
    justifyContent: 'center',
    paddingVertical: 12,
  },
  buttonDisabled: {
    opacity: 0.5,
  },
  buttonPressed: {
    opacity: 0.85,
  },
  buttonText: {
    color: '#FFFFFF',
    fontWeight: '700',
  },
  error: {
    color: '#DC2626',
    fontSize: 12,
    marginTop: 2,
  },
  linkButton: {
    alignItems: 'center',
    marginTop: 6,
  },
  linkButtonText: {
    color: '#2563EB',
    fontSize: 13,
    fontWeight: '600',
  },
});
