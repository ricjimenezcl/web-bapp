// ─── Backend response shapes ─────────────────────────────────────────────────

export interface UserBasicResponse {
  id: number;
  email: string;
  role: string;
  status: string;
  name?: string;
}

/** Backend MessageResponse from GET /chat/conversations/{id}/messages */
export interface ChatMessage {
  id: number;
  conversation_id: number;
  sender_id: number;
  message_content: string;
  is_read: boolean;
  read_at?: string;
  created_at: string;
  updated_at?: string;
}

/** Backend ConversationDetailResponse — flat, from POST /chat/conversations/{provider_id}
 *  and GET /chat/conversations/{id} */
export interface ConversationDetailResponse {
  id: number;
  client_id: number;
  provider_id: number;
  started_at: string;
  ended_at?: string | null;
  created_at: string;
  updated_at: string;
  client?: UserBasicResponse | null;
  provider?: UserBasicResponse | null;
  messages: ChatMessage[];
}

/** Backend ConversationResponse — enriched item inside list */
export interface ConversationResponse {
  id: number;
  client_id: number;
  provider_id: number;
  started_at: string;
  ended_at?: string;
  created_at: string;
  updated_at: string;
  other_participant_id?: number;
  other_participant_name?: string;
  other_participant_avatar?: string;
  last_message_preview?: string;
  unread_count: number;
}

/** Backend ConversationListResponse from GET /chat/conversations */
export interface ConversationListResponse {
  total: number;
  skip: number;
  limit: number;
  items: ConversationResponse[];
}

// ─── UI shape used by list components ────────────────────────────────────────

/** Normalized conversation for UI components */
export interface ConversationUI {
  id: number;
  client_id: number;
  provider_id: number;
  started_at: string;
  ended_at?: string;
  created_at?: string;
  updated_at?: string;
  other_user_id?: number;
  display_name?: string;
  other_user_avatar?: string;
  last_message_preview?: string;
  unread_count?: number;
  is_active?: boolean;
}

// ─── WebSocket message types ──────────────────────────────────────────────────

export interface WsMessage {
  channel: 'chat' | 'notification';
  type: string;
  conversation_id?: number;
  data?: any;
}

export interface WsChatMessage {
  type: 'message';
  channel: 'chat';
  conversation_id: number;
  // Campos planos del mensaje (formato que emite el backend via WS)
  message_id: number;
  sender_id: number;
  sender_name?: string;
  content: string;
  timestamp: string;
  is_read: boolean;
}

export interface WsTypingIndicator {
  type: 'typing';
  channel: 'chat';
  conversation_id: number;
  user_id: number;
  is_typing: boolean;
}

export interface WsNotification {
  type: 'notification';
  channel: 'notification';
  notification_id: number;
  notification_type: string;
  title: string;
  content: string;
  related_entity_id?: number;
  related_entity_type?: string;
  timestamp: string;
  is_read: boolean;
}
