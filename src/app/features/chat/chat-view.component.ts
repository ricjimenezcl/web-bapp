import { Component, Input, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, EventEmitter, Output, CUSTOM_ELEMENTS_SCHEMA, SimpleChanges, OnChanges } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { Subscription, filter, take } from 'rxjs';
import { ChatService } from '../../core/services/chat.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { StorageService } from '../../core/services/storage.service';
import { ChatMessage, ConversationDetailResponse, UserBasicResponse } from '../../core/models/chat.model';
import { ContentFilterService } from '../../shared/services/content-filter.service';
import { offensiveContentAsyncValidator } from '../../shared/validators/content-filter.validators';

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

  private readonly chatSvc  = inject(ChatService);
  private readonly ws       = inject(WebSocketService);
  private readonly storage  = inject(StorageService);
  private readonly fb       = inject(FormBuilder);
  private readonly contentFilterService = inject(ContentFilterService);

  messages          = signal<ChatMessage[]>([]);
  conversationInfo  = signal<ConversationDetailResponse | null>(null);
  otherParticipant  = signal<UserBasicResponse | null>(null);
  loading           = signal(true);
  sending           = signal(false);
  typing            = signal(false);
  chatInputError    = signal('');
  deletingMsgId     = signal<number | null>(null);
  activeMenuMsgId   = signal<number | null>(null);
  typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldScrollToBottom = true;

  messageControl = this.fb.control('', {
    asyncValidators: [offensiveContentAsyncValidator(this.contentFilterService, 'chat')],
    updateOn: 'change',
  });
  currentUserId  = this.storage.user()?.id ?? 0;

  private subs: Subscription[] = [];
  private _initialized = false;

  private normalizeMessages(msgs: ChatMessage[] | null | undefined): ChatMessage[] {
    return [...(msgs ?? [])].sort((a, b) =>
      new Date(a.created_at).getTime() - new Date(b.created_at).getTime()
    );
  }

  goBack(): void {
    this.close.emit();
  }

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['conversationId'] && this.conversationId) {
      this._initialized = true;
      this.cleanup();
      this.initChat();
    }
  }

  ngOnInit(): void {
    // ngOnChanges ya llamó initChat() si el input llegó antes de OnInit
    if (!this._initialized && this.conversationId) {
      this._initialized = true;
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

        this.chatSvc.getAllMessages(this.conversationId, 100, 50).subscribe({
          next: (msgs) => {
            this.messages.set(this.normalizeMessages(msgs));
            this.shouldScrollToBottom = true;
            this.loading.set(false);
            requestAnimationFrame(() => this.scrollToBottom());
            this.chatSvc.markAllRead(this.conversationId).subscribe({ error: () => {} });
          },
          error: () => this.loading.set(false)
        });
      },
      error: () => this.loading.set(false)
    });

    // Unirse a la sala WS — si la conexión aún no está abierta, esperar el primer connected=true
    if (this.ws.connected$.value) {
      this.ws.joinChat(this.conversationId);
    } else {
      const joinSub = this.ws.connected$.pipe(filter(c => c), take(1)).subscribe(() => {
        this.ws.joinChat(this.conversationId);
      });
      this.subs.push(joinSub);
    }

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
          this.messages.update(list => this.normalizeMessages([...list, chatMsg]));
          this.shouldScrollToBottom = true;
          requestAnimationFrame(() => this.scrollToBottom());
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
    if (this.chatInputError()) {
      this.chatInputError.set('');
    }
    this.ws.sendTyping(this.conversationId, true);
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
    this.typingTimeout = setTimeout(() => {
      this.ws.sendTyping(this.conversationId, false);
    }, 2000);
  }

  send(): void {
    const content = this.messageControl.value?.trim();
    if (!content || this.sending() || this.messageControl.pending) return;
    if (this.messageControl.errors?.['offensiveContent']) {
      this.chatInputError.set('El mensaje contiene lenguaje no permitido. Ajusta el texto para continuar.');
      return;
    }

    this.chatInputError.set('');
    this.sending.set(true);
    this.messageControl.setValue('');
    this.ws.sendTyping(this.conversationId, false);

    this.chatSvc.sendMessage(this.conversationId, content).subscribe({
      next: () => {
        // El mensaje llega al emisor vía WS broadcast (el backend lo incluye también al emisor)
        // No lo agregamos aquí para evitar duplicados
        this.shouldScrollToBottom = true;
        this.sending.set(false);
      },
      error: () => {
        this.messageControl.setValue(content);
        this.chatInputError.set('No pudimos enviar el mensaje. Intenta nuevamente.');
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

  toggleMessageMenu(msgId: number, event: Event): void {
    event.stopPropagation();
    this.activeMenuMsgId.update(v => v === msgId ? null : msgId);
  }

  closeMenuOnOutsideClick(): void {
    this.activeMenuMsgId.set(null);
  }

  deleteMessage(msg: ChatMessage): void {
    if (!this.isMyMessage(msg)) return;
    this.activeMenuMsgId.set(null);
    this.deletingMsgId.set(msg.id);
    this.chatSvc.deleteMessage(this.conversationId, msg.id).subscribe({
      next: () => {
        this.messages.update(list => list.filter(m => m.id !== msg.id));
        this.deletingMsgId.set(null);
        this.shouldScrollToBottom = true;
        requestAnimationFrame(() => this.scrollToBottom());
      },
      error: () => this.deletingMsgId.set(null)
    });
  }

  ngOnDestroy(): void {
    this.cleanup();
  }
}
