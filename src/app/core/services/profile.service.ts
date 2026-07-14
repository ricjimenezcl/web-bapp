import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, tap } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';
import { UserProfile } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly http    = inject(HttpClient);
  private readonly storage = inject(StorageService);
  private readonly api = environment.apiUrl;

  /** GET /clients/me → flat ClientPublicResponse { id, user_id, full_name, phone, avatar, bio, email, rating_avg } */
  getMe(): Observable<UserProfile> {
    return this.http.get<UserProfile>(`${this.api}/clients/me`).pipe(
      tap(p => this.storage.setProfile(p))
    );
  }

  updateMe(data: Partial<UserProfile>): Observable<UserProfile> {
    return this.http.patch<UserProfile>(`${this.api}/clients/me`, data).pipe(
      tap(p => this.storage.updateProfile(p))
    );
  }

  changePassword(oldPassword: string, newPassword: string): Observable<any> {
    return this.http.post(`${this.api}/profile/change-password`, {
      old_password: oldPassword,
      new_password: newPassword,
    });
  }

  uploadAvatar(file: File): Observable<{ avatar_url: string }> {
    const formData = new FormData();
    formData.append('file', file);

    const role = this.storage.user()?.role;
    const endpoint = role === 'PROVIDER'
      ? `${this.api}/provider/images/avatar`
      : `${this.api}/client/images/avatar`;

    return this.http.post<{ avatar_url: string }>(endpoint, formData);
  }

  updateClientProfile(data: Partial<UserProfile>): Observable<UserProfile> {
    return this.updateMe(data);
  }
}
