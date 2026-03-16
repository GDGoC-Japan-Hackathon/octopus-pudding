export type FriendUser = {
  id: number;
  email: string;
  username: string;
  profile_image_url?: string | null;
  nearest_station?: string | null;
};

export type FriendRequestResponse = {
  id: number;
  requester_user_id: number;
  addressee_user_id: number;
  status: string;
  created_at?: string | null;
  updated_at?: string | null;
  requester?: FriendUser | null;
  addressee?: FriendUser | null;
};

export type FriendRequestCreatePayload = {
  target_user_id: number;
};

export type IncomingFriendRequestsResponse = FriendRequestResponse[];
export type OutgoingFriendRequestsResponse = FriendRequestResponse[];
