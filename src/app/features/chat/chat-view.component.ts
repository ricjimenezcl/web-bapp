import { Component, Input, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, EventEmitter, Output, CUSTOM_ELEMENTS_SCHEMA, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatService } from '../../core/services/chat.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { StorageService } from '../../core/services/storage.service';
import { ChatMessage, ConversationDetailResponse, UserBasicResponse } from '../../core/models/chat.model';

@Component({
  selector: 'app-chat-view',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule],
  templateUrl: './chat-view.component.html',
  styleUrl: './chat.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ChatViewComponent implements OnInit, OnDestroy, AfterViewChecked, OnChanges {
  @Input() conversationId!: number;
  @Output() close = new EventEmitter<void>();

  @ViewChild('messagesEnd') messagesEnd!: ElementRef;
  @ViewChild('messagesArea') messagesArea!: ElementRef;

  private chatSvc  = inject(ChatService);
  private ws       = inject(WebSocketService);
  private storage  = inject(StorageService);
  private fb       = inject(FormBuilder);

  messages          = signal<ChatMessage[]>([]);
  conversationInfo  = signal<ConversationDetailResponse | null>(null);
  otherParticipant  = signal<UserBasicResponse | null>(null);
  loading           = signal(true);
  sending           = signal(false);
  typing            = signal(false);
  typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldScrollToBottom = true;

  messageControl = this.fb.control('');
  currentUserId  = this.storage.user()?.id ?? 0;

  private subs: Subscription[] = [];

  goBack(): void {
    this.close.emit();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['conversationId'] && this.conversationId) {
      this.cleanup();
      this.initChat();
    }
  }

  ngOnInit(): void {
    if (this.conversationId) {
      this.initChat();
    }
  }

  private cleanup(): void {
    this.ws.leaveChat(this.conversationId);
    this.subs.forEach(s => s.unsubscribe());
    this.subs = [];
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
  }

  private initChat(): void {
    this.chatSvc.getConversation(this.conversationId).subscribe({
      next: (res) => {
        this.conversationInfo.set(res);
        const other = (this.currentUserId === res.client_id)
          ? res.provider
          : res.client;
        this.otherParticipant.set(other ?? null);

        this.chatSvc.getMessages(this.conversationId).subscribe({
          next: (msgs) => {
            this.messages.set(msgs ?? []);
            this.shouldScrollToBottom = true;
            this.loading.set(false);
            this.chatSvc.markAllRead(this.conversationId).subscribe({ error: () => {} });
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });

    this.ws.joinChat(this.conversationId);

    this.subs.push(
      this.ws.chatMessage$.subscribe(msg => {
        if (msg.conversation_id === this.conversationId) {
          // El backend emite el mensaje plano (no anidado en .message)
          // Mapeamos al formato ChatMessage que usa la lista
          const chatMsg: ChatMessage = {
            id:               msg.message_id,
            conversation_id:  msg.conversation_id,
            sender_id:        msg.sender_id,
            message_content:  msg.content,
            is_read:          msg.is_read,
            created_at:       msg.timestamp,
          };
          this.messages.update(list => [...list, chatMsg]);
          this.shouldScrollToBottom = true;
          if (msg.sender_id !== this.currentUserId) {
            this.chatSvc.markAllRead(this.conversationId).subscribe({ error: () => {} });
          }
        }
      }),
      this.ws.typing$.subscribe(t => {
        if (t.conversation_id === this.conversationId && t.user_id !== this.currentUserId) {
          this.typing.set(t.is_typing);
        }
      })
    );
  }

  ngAfterViewChecked(): void {
    if (this.shouldScrollToBottom) {
      this.scrollToBottom();
      this.shouldScrollToBottom = false;
    }
  }

  onInput(): void {
    this.ws.sendTyping(this.conversationId, true);
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.ws.sendTyping(this.conversationId, false);
    }, 2000);
  }

  send(): void {
    const content = this.messageControl.value?.trim();
    if (!content || this.sending()) return;
    this.sending.set(true);
    this.messageControl.setValue('');
    this.ws.sendTyping(this.conversationId, false);

    this.chatSvc.sendMessage(this.conversationId, content).subscribe({
      next: (msg) => {
        this.messages.update(list => [...list, msg]);
        this.shouldScrollToBottom = true;
        this.sending.set(false);
      },
      error: () => {
        this.messageControl.setValue(content);
        this.sending.set(false);
      }
    });
  }

  onKeydown(event: KeyboardEvent): void {
    if (event.key === 'Enter' && !event.shiftKey) {
      event.preventDefault();
      this.send();
    }
  }

  private scrollToBottom(): void {
    try {
      const el = this.messagesArea?.nativeElement as HTMLElement;
      if (el) { el.scrollTop = el.scrollHeight; }
    } catch { /* ignore */ }
  }

  isMyMessage(msg: ChatMessage): boolean {
    return msg.sender_id === this.currentUserId;
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
