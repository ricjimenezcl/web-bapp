import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable } from 'rxjs';
import { tap, map } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import {
  ConversationUI, ConversationListResponse, ConversationResponse,
  ConversationDetailResponse, ChatMessage
} from '../models/chat.model';

@Injectable({ providedIn: 'root' })
export class ChatService {
  private readonly http = inject(HttpClient);
  private readonly api  = environment.apiUrl;

  private _conversations$ = new BehaviorSubject<ConversationUI[]>([]);
  readonly conversations$ = this._conversations$.asObservable();

  /** Maps backend ConversationResponse → UI-friendly ConversationUI */
  private _toUI(c: ConversationResponse): ConversationUI {
    return {
      id:                   c.id,
      client_id:            c.client_id,
      provider_id:          c.provider_id,
      started_at:           c.started_at,
      ended_at:             c.ended_at,
      created_at:           c.created_at,
      updated_at:           c.updated_at,
      other_user_id:        c.other_participant_id,
      display_name:         c.other_participant_name,
      other_user_avatar:    c.other_participant_avatar,
      last_message_preview: c.last_message_preview,
      unread_count:         c.unread_count,
    };
  }

  /** GET /chat/conversations — returns paginated list and updates conversations$ */
  loadConversations(skip = 0, limit = 50): Observable<ConversationUI[]> {
    return this.http.get<ConversationListResponse>(`${this.api}/chat/conversations`, {
      params: { skip, limit }
    }).pipe(
      map(res => (res.items ?? []).map(c => this._toUI(c))),
      tap(list => this._conversations$.next(list))
    );
  }

  /** POST /chat/conversations/{providerId} — get or create conversation */
  createConversation(providerId: number): Observable<ConversationDetailResponse> {
    return this.http.post<ConversationDetailResponse>(
      `${this.api}/chat/conversations/${providerId}`, {}
    );
  }

  /** GET /chat/conversations/{id} — conversation metadata (messages NOT included, fetch separately) */
  getConversation(id: number): Observable<ConversationDetailResponse> {
    return this.http.get<ConversationDetailResponse>(`${this.api}/chat/conversations/${id}`);
  }

  /** GET /chat/conversations/{id}/messages */
  getMessages(conversationId: number, skip = 0, limit = 50): Observable<ChatMessage[]> {
    return this.http.get<ChatMessage[]>(
      `${this.api}/chat/conversations/${conversationId}/messages`,
      { params: { skip, limit } }
    );
  }

  /** POST /chat/conversations/{id}/messages */
  sendMessage(conversationId: number, content: string): Observable<ChatMessage> {
    return this.http.post<ChatMessage>(
      `${this.api}/chat/conversations/${conversationId}/messages`,
      { content }
    );
  }

  /** POST /chat/conversations/{id}/read-all */
  markAllRead(conversationId: number): Observable<any> {
    return this.http.post(`${this.api}/chat/conversations/${conversationId}/read-all`, {});
  }

  applyLocalMessageUpdate(conversationId: number, preview: string): void {
    const list = this._conversations$.value;
    const idx  = list.findIndex(c => c.id === conversationId);
    if (idx === -1) return;
    const updated = [...list];
    updated[idx] = {
      ...updated[idx],
      last_message_preview: preview,
      unread_count: (updated[idx].unread_count ?? 0) + 1,
      updated_at: new Date().toISOString(),
    };
    updated.sort((a, b) =>
      new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
    );
    this._conversations$.next(updated);
  }
}
