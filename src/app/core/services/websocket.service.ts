import { Injectable, inject, OnDestroy } from '@angular/core';
import { Subject, BehaviorSubject } from 'rxjs';
import { environment } from '../../../environments/environment';
import { StorageService } from './storage.service';
import { WsChatMessage, WsTypingIndicator, WsNotification } from '../models/chat.model';

@Injectable({ providedIn: 'root' })
export class WebSocketService implements OnDestroy {
  private readonly storage = inject(StorageService);

  private ws: WebSocket | null = null;
  private reconnectTimer: ReturnType<typeof setTimeout> | null = null;
  private reconnectDelay = 1000;
  private readonly maxReconnectDelay = 30000;
  private heartbeatInterval: ReturnType<typeof setInterval> | null = null;
  private intentionalClose = false;

  readonly connected$      = new BehaviorSubject<boolean>(false);
  readonly chatMessage$    = new Subject<WsChatMessage>();
  readonly typing$         = new Subject<WsTypingIndicator>();
  readonly notification$   = new Subject<WsNotification>();
  readonly reconnected$    = new Subject<void>();

  connect(): void {
    if (!this.storage.isAuthenticated()) {
      this.disconnect();
      return;
    }

    const token = this.storage.token();
    if (this.ws?.readyState === WebSocket.OPEN || this.ws?.readyState === WebSocket.CONNECTING) return;

    this.intentionalClose = false;
    const url = token
      ? `${environment.wsUrl}/unified?token=${encodeURIComponent(token)}`
      : `${environment.wsUrl}/unified`;
    this.ws = new WebSocket(url);

    this.ws.onopen = () => {
      this.connected$.next(true);
      this.reconnectDelay = 1000;
      this._startHeartbeat();
    };

    this.ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        this._handleMessage(msg);
      } catch { /* ignore parse errors */ }
    };

    this.ws.onclose = (event) => {
      this.connected$.next(false);
      this._stopHeartbeat();
      if (!this.intentionalClose && this.storage.isAuthenticated()) {
        // 4401 = token/cookie inválida o expirada: evitar bucle infinito de reconexión.
        if (event.code === 4401) {
          this.disconnect();
          return;
        }
        this._scheduleReconnect();
      }
    };

    this.ws.onerror = () => {
      this.ws?.close();
    };
  }

  disconnect(): void {
    this.intentionalClose = true;
    this._clearReconnect();
    this._stopHeartbeat();
    if (this.ws) {
      this.ws.close();
      this.ws = null;
    }
    this.connected$.next(false);
  }

  send(data: object): void {
    if (this.ws?.readyState === WebSocket.OPEN) {
      this.ws.send(JSON.stringify(data));
    }
  }

  joinChat(conversationId: number): void {
    this.send({ channel: 'chat', type: 'join', conversation_id: conversationId });
  }

  leaveChat(conversationId: number): void {
    this.send({ channel: 'chat', type: 'leave', conversation_id: conversationId });
  }

  sendChatMessage(conversationId: number, content: string): void {
    this.send({ channel: 'chat', type: 'message', conversation_id: conversationId, data: { content } });
  }

  sendTyping(conversationId: number, isTyping: boolean): void {
    this.send({ channel: 'chat', type: 'typing', conversation_id: conversationId, data: { is_typing: isTyping } });
  }

  sendReadConfirmation(conversationId: number, messageId: number): void {
    this.send({ channel: 'chat', type: 'read', conversation_id: conversationId, data: { message_id: messageId } });
  }

  private _handleMessage(msg: any): void {
    if (!msg) return;

    if (msg.type === 'pong') return;

    if (msg.channel === 'notification' && msg.type === 'notification') {
      this.notification$.next(msg as WsNotification);
      return;
    }

    if (msg.channel === 'chat') {
      if (msg.type === 'message') this.chatMessage$.next(msg as WsChatMessage);
      if (msg.type === 'typing')  this.typing$.next(msg as WsTypingIndicator);
    }
  }

  private _startHeartbeat(): void {
    this._stopHeartbeat();
    this.heartbeatInterval = setInterval(() => {
      this.send({ channel: 'notification', type: 'ping' });
    }, 25000);
  }

  private _stopHeartbeat(): void {
    if (this.heartbeatInterval) {
      clearInterval(this.heartbeatInterval);
      this.heartbeatInterval = null;
    }
  }

  private _scheduleReconnect(): void {
    if (!this.storage.isAuthenticated()) {
      this.disconnect();
      return;
    }

    this._clearReconnect();
    this.reconnectTimer = setTimeout(() => {
      if (!this.storage.isAuthenticated()) {
        this.disconnect();
        return;
      }

      this.reconnectDelay = Math.min(this.reconnectDelay * 2, this.maxReconnectDelay);
      this.reconnected$.next();
      this.connect();
    }, this.reconnectDelay);
  }

  private _clearReconnect(): void {
    if (this.reconnectTimer) {
      clearTimeout(this.reconnectTimer);
      this.reconnectTimer = null;
    }
  }

  ngOnDestroy(): void {
    this.disconnect();
  }
}
