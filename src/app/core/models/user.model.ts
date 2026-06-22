export type UserRole = 'CLIENT' | 'PROVIDER' | 'ADMIN';
export type UserStatus = 'PENDING' | 'ACTIVE' | 'SUSPENDED' | 'REJECTED';

export interface User {
  id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
  access_token?: string;
  user_id?: number;
  provider_id?: number;
  client_id?: number;
  name?: string;
  picture?: string;
  verified?: boolean;
  terms_accepted?: boolean;
  has_premium?: boolean;
}

export interface UserProfile {
  id: number;
  user_id: number;
  full_name: string;
  has_premium?: boolean;
  phone?: string;
  avatar?: string | null;
  bio?: string;
  rating_avg?: number;
  email?: string;
  role?: UserRole;
  status?: UserStatus;
  run?: string;
  created_at?: string;
  updated_at?: string;
}

export interface StoredUser {
  id: number;
  email: string;
  role: UserRole;
  status: UserStatus;
  provider_id?: number;
  client_id?: number;
  has_premium?: boolean;
}

export interface LoginRequest {
  username: string;
  password: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user_id: number;
  role: UserRole;
  status: UserStatus;
  provider_id?: number;
  client_id?: number;
  email?: string;
  name?: string;
  avatar_url?: string;
  terms_accepted?: boolean;
}

export interface ClientRegister {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  terms_accepted: boolean;
}

export interface ProviderRegister {
  email: string;
  password: string;
  full_name: string;
  phone: string;
  terms_accepted: boolean;
  run?: string;
}
