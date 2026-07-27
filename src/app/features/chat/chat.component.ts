import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef, AfterViewChecked, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder } from '@angular/forms';
import { RouterLink, ActivatedRoute } from '@angular/router';
import { Subscription, filter, take } from 'rxjs';
import { ChatService } from '../../core/services/chat.service';
import { WebSocketService } from '../../core/services/websocket.service';
import { StorageService } from '../../core/services/storage.service';
import { PlatformI18nService } from '../../core/services/platform-i18n.service';
import { ChatMessage, ConversationDetailResponse, UserBasicResponse } from '../../core/models/chat.model';
import { ContentFilterService } from '../../shared/services/content-filter.service';
import { offensiveContentAsyncValidator } from '../../shared/validators/content-filter.validators';
import { TPipe } from '../../shared/pipes/t.pipe';

@Component({
  selector: 'app-chat',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterLink, TPipe],
  templateUrl: './chat.component.html',
  styleUrl: './chat.component.scss',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ChatComponent implements OnInit, OnDestroy, AfterViewChecked {
  @ViewChild('messagesEnd') messagesEnd!: ElementRef;

  private readonly route    = inject(ActivatedRoute);
  private readonly chatSvc  = inject(ChatService);
  private readonly ws       = inject(WebSocketService);
  private readonly storage  = inject(StorageService);
  private readonly fb       = inject(FormBuilder);
  private readonly contentFilterService = inject(ContentFilterService);
  private readonly i18n = inject(PlatformI18nService);

  conversationId!: number;
  messages          = signal<ChatMessage[]>([]);
  conversationInfo  = signal<ConversationDetailResponse | null>(null);
  otherParticipant  = signal<UserBasicResponse | null>(null);
  loading           = signal(true);
  sending           = signal(false);
  typing            = signal(false);
  chatInputError    = signal('');
  typingTimeout: ReturnType<typeof setTimeout> | null = null;
  private shouldScrollToBottom = true;

  messageControl = this.fb.control('', {
    asyncValidators: [offensiveContentAsyncValidator(this.contentFilterService, 'chat')],
    updateOn: 'change',
  });
  currentUserId  = this.storage.user()?.id ?? 0;

  private readonly subs: Subscription[] = [];

  goBack(): void { window.history.back(); }

  ngOnInit(): void {
    this.conversationId = Number(this.route.snapshot.paramMap.get('id'));

    // Load conversation metadata first, then messages separately
    this.chatSvc.getConversation(this.conversationId).subscribe({
      next: (res) => {
        this.conversationInfo.set(res);
        // Determine "other participant": if I'm the client, other is provider; else client
        const other = (this.currentUserId === res.client_id)
          ? res.provider
          : res.client;
        this.otherParticipant.set(other ?? null);

        // Load messages via dedicated endpoint
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

    // Unirse a la sala WS — si no está conectado aún, esperar
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
          const chatMsg: ChatMessage = {
            id:              msg.message_id,
            conversation_id: msg.conversation_id,
            sender_id:       msg.sender_id,
            message_content: msg.content,
            is_read:         msg.is_read,
            created_at:      msg.timestamp,
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
      this.chatInputError.set(this.i18n.t('chat.messageBlocked'));
      return;
    }

    this.chatInputError.set('');
    this.sending.set(true);
    this.messageControl.setValue('');
    this.ws.sendTyping(this.conversationId, false);

    this.chatSvc.sendMessage(this.conversationId, content).subscribe({
      next: () => {
        // El mensaje llegará vía WS broadcast al emisor (no agregar localmente para evitar duplicados)
        this.shouldScrollToBottom = true;
        this.sending.set(false);
      },
      error: () => {
        this.messageControl.setValue(content);
        this.chatInputError.set(this.i18n.t('chat.sendError'));
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
      this.messagesEnd?.nativeElement?.scrollIntoView({ behavior: 'smooth' });
    } catch { /* ignore */ }
  }

  isMyMessage(msg: ChatMessage): boolean {
    return msg.sender_id === this.currentUserId;
  }

  ngOnDestroy(): void {
    this.ws.leaveChat(this.conversationId);
    this.subs.forEach(s => s.unsubscribe());
    if (this.typingTimeout) clearTimeout(this.typingTimeout);
  }
}
