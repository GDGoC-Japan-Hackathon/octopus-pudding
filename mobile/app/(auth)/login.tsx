import { MaterialIcons } from '@expo/vector-icons';
import { useRef, useState } from 'react';
import { ActivityIndicator, Pressable, StyleSheet, Text, TextInput, View } from 'react-native';

import { useAuth } from '@/features/auth/hooks/use-auth';
import { validateSignupPassword } from '@/features/auth/utils/password';

type AuthMode = 'login' | 'signup';

type FirebaseAuthLikeError = {
  code?: string;
};

function getFirebaseAuthErrorCode(error: unknown): string | null {
  if (typeof error === 'object' && error && 'code' in error) {
    return (error as FirebaseAuthLikeError).code ?? null;
  }
  return null;
}

function getAuthErrorMessage(mode: AuthMode, error: unknown): string {
  const code = getFirebaseAuthErrorCode(error);

  if (mode === 'login') {
    switch (code) {
      case 'auth/invalid-email':
        return 'メールアドレスの形式を確認してください。';
      case 'auth/too-many-requests':
        return '試行回数が多すぎます。時間をおいて再度お試しください。';
      default:
        return 'ログインに失敗しました。メールアドレスまたはパスワードを確認してください。';
    }
  }

  switch (code) {
    case 'auth/weak-password':
      return 'パスワードは6文字以上で入力してください。';
    case 'auth/email-already-in-use':
      return 'このメールアドレスは既に使用されています。';
    case 'auth/invalid-email':
      return 'メールアドレスの形式を確認してください。';
    case 'auth/too-many-requests':
      return '試行回数が多すぎます。時間をおいて再度お試しください。';
    default:
      return '新規登録に失敗しました。メール形式やパスワード(6文字以上)を確認してください。';
  }
}

export default function LoginScreen() {
  const { isLoading, signIn, signUp } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [mode, setMode] = useState<AuthMode>('login');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isPasswordVisible, setIsPasswordVisible] = useState(false);
  const [isConfirmPasswordVisible, setIsConfirmPasswordVisible] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmPasswordError, setConfirmPasswordError] = useState<string | null>(null);
  const submitLockRef = useRef(false);

  const isSignup = mode === 'signup';
  const isBusy = isSubmitting || isLoading;
  const passwordValidation = validateSignupPassword(password);
  const canSubmit =
    !!email.trim() &&
    !!password &&
    (isSignup
      ? !!confirmPassword && passwordValidation.isValid && password === confirmPassword
      : true);

  const handleEmailChange = (value: string) => {
    setEmail(value);
    setError(null);
  };

  const handlePasswordChange = (value: string) => {
    setPassword(value);
    setError(null);

    if (!isSignup) {
      return;
    }

    if (!confirmPassword) {
      setConfirmPasswordError(null);
      return;
    }

    setConfirmPasswordError(value === confirmPassword ? null : '確認用パスワードが一致しません。');
  };

  const handleConfirmPasswordChange = (value: string) => {
    setConfirmPassword(value);
    setError(null);

    if (!value) {
      setConfirmPasswordError(null);
      return;
    }

    setConfirmPasswordError(value === password ? null : '確認用パスワードが一致しません。');
  };

  const handleModeToggle = () => {
    setMode((prev) => (prev === 'login' ? 'signup' : 'login'));
    setConfirmPassword('');
    setConfirmPasswordError(null);
    setError(null);
    setIsPasswordVisible(false);
    setIsConfirmPasswordVisible(false);
  };

  const handleSubmit = async () => {
    if (submitLockRef.current || isBusy) {
      return;
    }

    setError(null);

    if (isSignup) {
      if (!passwordValidation.isValid) {
        setError('パスワードは6文字以上で入力してください。');
        return;
      }

      if (!confirmPassword) {
        setConfirmPasswordError('確認用パスワードを入力してください。');
        return;
      }

      if (password !== confirmPassword) {
        setConfirmPasswordError('確認用パスワードが一致しません。');
        return;
      }
    }

    setConfirmPasswordError(null);
    submitLockRef.current = true;
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
      setError(getAuthErrorMessage(mode, error));
    } finally {
      console.log('Auth submit finished');
      submitLockRef.current = false;
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
          onChangeText={handleEmailChange}
          placeholder="you@example.com"
          style={styles.input}
        />

        <Text style={styles.label}>パスワード</Text>
        <View style={styles.inputRow}>
          <TextInput
            autoCapitalize="none"
            autoCorrect={false}
            secureTextEntry={!isPasswordVisible}
            value={password}
            onChangeText={handlePasswordChange}
            placeholder="********"
            style={styles.inputWithToggle}
          />
          <Pressable
            accessibilityRole="button"
            onPress={() => setIsPasswordVisible((prev) => !prev)}
            style={({ pressed }) => [styles.visibilityButton, pressed && styles.buttonPressed]}
          >
            <MaterialIcons
              name={isPasswordVisible ? 'visibility-off' : 'visibility'}
              size={20}
              color="#64748B"
            />
          </Pressable>
        </View>

        {isSignup ? (
          <View style={styles.passwordRules}>
            <Text style={styles.passwordRulesTitle}>パスワード条件</Text>
            {passwordValidation.rules.map((rule) => {
              const ruleColor = !password
                ? '#64748B'
                : rule.isSatisfied
                  ? '#15803D'
                  : '#DC2626';

              return (
                <View key={rule.key} style={styles.passwordRuleItem}>
                  <MaterialIcons
                    name={rule.isSatisfied ? 'check-circle' : 'radio-button-unchecked'}
                    size={16}
                    color={ruleColor}
                  />
                  <Text style={[styles.passwordRuleText, { color: ruleColor }]}>{rule.label}</Text>
                </View>
              );
            })}
          </View>
        ) : null}

        {isSignup ? (
          <>
            <Text style={styles.label}>確認用パスワード</Text>
            <View style={styles.inputRow}>
              <TextInput
                autoCapitalize="none"
                autoCorrect={false}
                secureTextEntry={!isConfirmPasswordVisible}
                value={confirmPassword}
                onChangeText={handleConfirmPasswordChange}
                placeholder="********"
                style={styles.inputWithToggle}
              />
              <Pressable
                accessibilityRole="button"
                onPress={() => setIsConfirmPasswordVisible((prev) => !prev)}
                style={({ pressed }) => [styles.visibilityButton, pressed && styles.buttonPressed]}
              >
                <MaterialIcons
                  name={isConfirmPasswordVisible ? 'visibility-off' : 'visibility'}
                  size={20}
                  color="#64748B"
                />
              </Pressable>
            </View>
            {confirmPasswordError ? <Text style={styles.error}>{confirmPasswordError}</Text> : null}
          </>
        ) : null}

        {error ? <Text style={styles.error}>{error}</Text> : null}

        <Pressable
          onPress={handleSubmit}
          disabled={isBusy || !canSubmit}
          style={({ pressed }) => [
            styles.button,
            (isBusy || !canSubmit) && styles.buttonDisabled,
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
          onPress={handleModeToggle}
          disabled={isBusy}
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
  inputRow: {
    flexDirection: 'row',
    alignItems: 'center',
    borderWidth: 1,
    borderColor: '#CBD5E1',
    borderRadius: 10,
    backgroundColor: '#FFFFFF',
  },
  inputWithToggle: {
    flex: 1,
    paddingLeft: 12,
    paddingVertical: 10,
  },
  visibilityButton: {
    paddingHorizontal: 12,
    paddingVertical: 10,
  },
  passwordRules: {
    gap: 6,
    marginTop: -2,
  },
  passwordRulesTitle: {
    color: '#475569',
    fontSize: 12,
    fontWeight: '600',
  },
  passwordRuleItem: {
    alignItems: 'center',
    flexDirection: 'row',
    gap: 6,
  },
  passwordRuleText: {
    fontSize: 12,
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
