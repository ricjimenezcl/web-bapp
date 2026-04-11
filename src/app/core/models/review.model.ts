export interface Review {
  id: number;
  booking_id: number;
  client_id: number;
  provider_id: number;
  rating: number;
  comment?: string;
  created_at: string;
  client?: { full_name: string; avatar?: string };
}

export interface CreateReviewRequest {
  booking_id: number;
  rating: number;
  comment?: string;
}
