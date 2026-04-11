import { Injectable, signal, computed } from '@angular/core';
import { StoredUser, UserProfile } from '../models/user.model';

const KEYS = {
  TOKEN:   'bapp_token',
  USER:    'bapp_user',
  PROFILE: 'bapp_profile',
} as const;

@Injectable({ providedIn: 'root' })
export class StorageService {
  private _token   = signal<string | null>(localStorage.getItem(KEYS.TOKEN));
  private _user    = signal<StoredUser | null>(this._parseJson(localStorage.getItem(KEYS.USER)));
  private _profile = signal<UserProfile | null>(this._parseJson(localStorage.getItem(KEYS.PROFILE)));

  readonly token          = this._token.asReadonly();
  readonly user           = this._user.asReadonly();
  readonly profile        = this._profile.asReadonly();
  readonly isAuthenticated = computed(() => !!this._token() && !!this._user());

  setToken(token: string): void {
    localStorage.setItem(KEYS.TOKEN, token);
    this._token.set(token);
  }

  setUser(user: StoredUser): void {
    localStorage.setItem(KEYS.USER, JSON.stringify(user));
    this._user.set(user);
  }

  setProfile(profile: UserProfile): void {
    localStorage.setItem(KEYS.PROFILE, JSON.stringify(profile));
    this._profile.set(profile);
  }

  updateProfile(partial: Partial<UserProfile>): void {
    const current = this._profile();
    if (current) {
      const updated = { ...current, ...partial };
      this.setProfile(updated);
    }
  }

  clearSession(): void {
    localStorage.removeItem(KEYS.TOKEN);
    localStorage.removeItem(KEYS.USER);
    localStorage.removeItem(KEYS.PROFILE);
    this._token.set(null);
    this._user.set(null);
    this._profile.set(null);
  }

  private _parseJson<T>(raw: string | null): T | null {
    if (!raw) return null;
    try { return JSON.parse(raw) as T; }
    catch { return null; }
  }
}
