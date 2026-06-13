export type BookingStatus =
  | 'PENDING'
  | 'APPROVED'
  | 'REJECTED'
  | 'COMPLETED'
  // Legacy — compatibilidad con datos históricos
  | 'CONFIRMED'
  | 'IN_PROGRESS'
  | 'CANCELLED'
  | 'NOSHOW';

export interface BookingCreate {
  provider_id: number;
  service_id: number;
  service_provider_id?: number;
  service_category?: string;
  scheduled_date: string;
  scheduled_time: string;
  duration: number;         // ge=15, le=480
  total_price: number;      // ge=0
  description?: string;
  location_address?: string;
  location_lat?: number;
  location_lng?: number;
}

export interface BookingResponse {
  id: string | number;
  client_id: string | number;
  provider_id: string | number;
  service_id?: string | number;
  service_provider_id?: number;
  service_category: string;
  location_address?: string;
  location_lat?: number;
  location_lng?: number;
  scheduled_date: string;
  scheduled_time?: string;
  duration?: number;
  total_price?: number;
  description?: string;
  status: BookingStatus;
  cancellation_reason?: string;
  payment_method?: string;
  currency?: string;
  created_at: string;
  updated_at?: string;
  completed_at?: string;
  provider?: { full_name: string; avatar?: string };
  client?: { full_name: string; avatar?: string };
  reviewed?: boolean;
}

export const BOOKING_STATUS_LABELS: Record<BookingStatus, string> = {
  PENDING:     'Pendiente',
  APPROVED:    'Aprobado',
  REJECTED:    'Rechazado',
  COMPLETED:   'Completado',
  CONFIRMED:   'Confirmado',
  IN_PROGRESS: 'En progreso',
  CANCELLED:   'Cancelado',
  NOSHOW:      'No presentado',
};

export const BOOKING_STATUS_COLORS: Record<BookingStatus, string> = {
  PENDING:     'badge-warning',
  APPROVED:    'badge-success',
  REJECTED:    'badge-danger',
  COMPLETED:   'badge-success',
  CONFIRMED:   'badge-primary',
  IN_PROGRESS: 'badge-primary',
  CANCELLED:   'badge-danger',
  NOSHOW:      'badge-gray',
};
