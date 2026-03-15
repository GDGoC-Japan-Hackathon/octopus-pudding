import { useAuthContext } from '@/app/providers/auth-provider';

export function useAuth() {
  return useAuthContext();
}
