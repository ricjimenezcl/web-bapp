export interface ProviderProfile {
  id: number;
  user_id: number;
  full_name: string;
  phone?: string;
  avatar?: string;
  bio?: string;
  rating_avg?: number;
  run?: string;
  email?: string;
  status?: 'ACTIVE' | 'PENDING' | 'REJECTED';
  is_available?: boolean;
  address?: string;
  total_reviews?: number;
  identity_document_url?: string;
  selfie_url?: string;
  validation_status?: 'pending' | 'approved' | 'rejected';
  has_premium?: boolean;
  business_name?: string;
  // Presente en /providers/{id}/detailed — servicios del proveedor embebidos
  services?: ServiceProvider[];
}

export interface ServiceProvider {
  id: number;
  provider_id: number;
  service_id: number;
  business_name: string;
  description?: string;
  address: string;
  latitude?: number;
  longitude?: number;
  phone: string;
  hourly_rate?: number;
  is_available: boolean;
  validation_status: string;
  rating_avg?: number;
  total_reviews?: number;
  service_category?: ServiceCategory;
  provider?: ProviderProfile;
  distance_km?: number;
  // Campos adicionales que retorna el backend directamente
  avatar?: string;
  full_name?: string;
  // Campos planos del endpoint geoespacial (se mapean a service_category en el service)
  service_category_name?: string;
  service_icon?: string;
  portfolio_images?: string[];
}

export interface ServiceCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  main_category_id?: number;
}

export interface MainCategory {
  id: number;
  name: string;
  description?: string;
  icon?: string;
  services?: ServiceCategory[];
}

export interface ProviderStats {
  total_services: number;
  active_services: number;
  pending_services: number;
  total_bookings: number;
  completed_bookings: number;
  pending_bookings: number;
  total_earnings: number;
  average_rating: number;
  total_reviews?: number;
  profile_views: number;
  service_views: number;
  zone_searches: number;
}

export interface ProviderWorkingHours {
  id?: number;
  provider_id?: number;
  day_of_week: number;
  start_time: string;
  end_time: string;
  is_active: boolean;
}

export const DAY_NAMES = ['Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado', 'Domingo'];
