import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { Subscription } from 'rxjs';
import { ChatService } from '../../../../core/services/chat.service';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { ConversationUI } from '../../../../core/models/chat.model';
import { ChatViewComponent } from '../../../../features/chat/chat-view.component';

@Component({
  selector: 'app-provider-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, ChatViewComponent],
  templateUrl: './provider-inbox.component.html',
  styleUrl: './provider-inbox.component.scss',
})
export class ProviderInboxComponent implements OnInit, OnDestroy {
  private readonly chatSvc = inject(ChatService);
  private readonly route   = inject(ActivatedRoute);
  private readonly ws      = inject(WebSocketService);
  conversations = signal<ConversationUI[]>([]);
  loading = signal(true);
  selectedConvId = signal<number | null>(null);
  searchText = '';
  private subs: Subscription[] = [];

  get filteredConversations(): ConversationUI[] {
    const q = this.searchText.trim().toLowerCase();
    if (!q) return this.conversations();
    return this.conversations().filter(c =>
      (c.display_name ?? '').toLowerCase().includes(q) ||
      (c.last_message_preview ?? '').toLowerCase().includes(q)
    );
  }

  selectChat(id: number): void { this.selectedConvId.set(id); }
  closeChat(): void { this.selectedConvId.set(null); }

  isNow(date?: string): boolean {
    if (!date) return false;
    return Date.now() - new Date(date).getTime() < 60_000;
  }

  ngOnInit(): void {
    const clientId = this.route.snapshot.queryParamMap.get('clientId');
    this.chatSvc.loadConversations().subscribe({
      next: (list) => {
        this.conversations.set(list);
        this.loading.set(false);
        if (clientId) {
          const conv = list.find(c => c.client_id === +clientId);
          if (conv) this.selectedConvId.set(conv.id);
        }
      },
      error: () => this.loading.set(false)
    });
    // Reflejar cambios de conversations$ (actualizados por applyLocalMessageUpdate)
    this.subs.push(
      this.chatSvc.conversations$.subscribe(c => this.conversations.set(c))
    );
    // Actualizar preview del sidebar cuando llega un mensaje WS
    this.subs.push(
      this.ws.chatMessage$.subscribe(msg => {
        this.chatSvc.applyLocalMessageUpdate(msg.conversation_id, msg.content);
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
