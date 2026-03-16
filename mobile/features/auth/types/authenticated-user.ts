export type AuthenticatedUser = {
  id: number;
  email: string;
  username: string;
  is_active: boolean;
  firebase_uid?: string | null;
  profile_image_url?: string | null;
  nearest_station?: string | null;
};
