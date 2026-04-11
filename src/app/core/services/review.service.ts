import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { Review, CreateReviewRequest } from '../models/review.model';

@Injectable({ providedIn: 'root' })
export class ReviewService {
  private http = inject(HttpClient);
  private readonly api = environment.apiUrl;

  createReview(data: CreateReviewRequest): Observable<Review> {
    return this.http.post<Review>(`${this.api}/reviews`, data);
  }

  getProviderReviews(providerId: number): Observable<Review[]> {
    return this.http.get<Review[]>(`${this.api}/reviews/providers/${providerId}/reviews`);
  }
}
