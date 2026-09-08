export type NotificationType =
  | 'message'
  | 'booking_received'
  | 'booking_request_sent'
  | 'booking_confirmed'
  | 'booking_rejected'
  | 'booking_reminder_24h'
  | 'booking_completed'
  | 'booking_review_request'
  | 'review_received'
  | 'service_approved'
  | 'payment_received'
  | 'chat_message';

export interface AppNotification {
  id: number;
  user_id: number;
  notification_type: NotificationType | string;
  title: string;
  content: string;
  related_entity_type?: string;
  related_entity_id?: number;
  is_read: boolean;
  read_at?: string;
  created_at: string;
}

export interface NotificationListResponse {
  notifications: AppNotification[];
  total: number;
  unread_count: number;
}
