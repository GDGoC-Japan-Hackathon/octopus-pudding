import { ApiError } from '@/lib/api/client';

export function getReplanningErrorMessage(error: unknown): string {
  if (!(error instanceof ApiError)) {
    return '保存に失敗しました。時間をおいて再度お試しください。';
  }
  if (error.status === 401) {
    return '認証が切れています。再ログイン後にもう一度お試しください。';
  }
  if (error.status === 403) {
    return 'このプランに対する操作権限がありません。';
  }
  if (error.status === 404) {
    return '対象プランが見つかりませんでした。プラン詳細から再計画を開いてください。';
  }
  return '再計画の保存に失敗しました。通信状態を確認してください。';
}
