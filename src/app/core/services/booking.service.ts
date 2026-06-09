import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { BookingCreate, BookingResponse } from '../models/booking.model';
import { AuthService } from './auth.service';

@Injectable({ providedIn: 'root' })
export class BookingService {
  private http = inject(HttpClient);
  private auth = inject(AuthService);
  private readonly api = environment.apiUrl;

  // CLIENT
  getClientBookings(): Observable<BookingResponse[]> {
    const userId = this.auth.currentUser()?.id ?? 0;
    return this.http.get<BookingResponse[]>(`${this.api}/bookings/client/${userId}`);
  }

  createBooking(data: BookingCreate): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`${this.api}/bookings`, data);
  }

  cancelBooking(id: number | string, reasonComment?: string): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`${this.api}/bookings/${id}/cancel`, {
      reason: 'CLIENT_REQUEST',
      reason_comment: reasonComment ?? null
    });
  }

  // PROVIDER
  getProviderBookings(): Observable<BookingResponse[]> {
    return this.http.get<BookingResponse[]>(`${this.api}/bookings/provider`);
  }

  confirmBooking(id: number): Observable<BookingResponse> {
    return this.http.post<BookingResponse>(`${this.api}/bookings/${id}/confirm`, {});
  }

  rejectBooking(id: number, reason?: string): Observable<BookingResponse> {
    return this.http.put<BookingResponse>(`${this.api}/bookings/${id}/status`, {
      status: 'REJECTED'
    });
  }

  completeBooking(id: number): Observable<BookingResponse> {
    return this.http.put<BookingResponse>(`${this.api}/bookings/${id}/status`, { status: 'COMPLETED' });
  }

  // SHARED
  getAvailableSlots(providerId: number, date: string, slotDuration = 60): Observable<{ slots: string[] }> {
    return this.http.get<{ slots: string[] }>(`${this.api}/bookings/available-slots`, {
      params: { provider_id: providerId, date, slot_duration: slotDuration }
    });
  }
}
