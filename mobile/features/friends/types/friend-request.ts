export type FriendUser = {
  id: number;
  email: string;
  username: string;
  profile_image_url?: string | null;
  nearest_station?: string | null;
};

export type FriendRequestStatus = 'pending' | 'accepted' | 'rejected' | 'blocked';
export type FriendRequestDecisionStatus = 'accepted' | 'rejected';

export type FriendRequestResponse = {
  id: number;
  requester_user_id: number;
  addressee_user_id: number;
  status: FriendRequestStatus;
  created_at?: string | null;
  updated_at?: string | null;
  requester?: FriendUser | null;
  addressee?: FriendUser | null;
};

export type FriendRequestCreatePayload = {
  target_user_id: number;
};

export type FriendRequestUpdatePayload = {
  status: FriendRequestDecisionStatus;
};

export type IncomingFriendRequestsResponse = FriendRequestResponse[];
export type OutgoingFriendRequestsResponse = FriendRequestResponse[];

export type FriendResponse = {
  request_id: number;
  user: FriendUser;
  created_at?: string | null;
  updated_at?: string | null;
};

export type FriendsResponse = FriendResponse[];
