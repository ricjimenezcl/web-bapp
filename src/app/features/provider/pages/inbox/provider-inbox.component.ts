import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ChatService } from '../../../../core/services/chat.service';
import { ConversationUI } from '../../../../core/models/chat.model';
import { ChatViewComponent } from '../../../../features/chat/chat-view.component';

@Component({
  selector: 'app-provider-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, ChatViewComponent],
  templateUrl: './provider-inbox.component.html',
  styleUrl: './provider-inbox.component.scss',
})
export class ProviderInboxComponent implements OnInit {
  private readonly chatSvc = inject(ChatService);
  private readonly route   = inject(ActivatedRoute);
  conversations = signal<ConversationUI[]>([]);
  loading = signal(true);
  selectedConvId = signal<number | null>(null);
  searchText = '';

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

  deleteConversation(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm('¿Eliminar esta conversación? Esta acción no se puede deshacer.')) return;
    this.chatSvc.deleteConversation(id).subscribe({
      next: () => {
        this.chatSvc.removeConversationLocally(id);
        this.conversations.update(list => list.filter(c => c.id !== id));
        if (this.selectedConvId() === id) this.selectedConvId.set(null);
      },
      error: () => {}
    });
  }

  isNow(date?: string): boolean {
    if (!date) return false;
    return Date.now() - new Date(date).getTime() < 60_000;
  }

  ngOnInit(): void {
    const clientId = this.route.snapshot.queryParamMap.get('clientId');
    this.chatSvc.loadAllConversations().subscribe({
      next: (list) => {
        const sorted = [...list].sort((a, b) =>
          new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
        );
        this.conversations.set(sorted);
        this.loading.set(false);
        if (clientId) {
          const conv = sorted.find(c => c.client_id === +clientId);
          if (conv) {
            this.selectedConvId.set(conv.id);
          } else if (sorted.length > 0) {
            this.selectedConvId.set(sorted[0].id);
          }
        } else if (!this.selectedConvId() && sorted.length > 0) {
          this.selectedConvId.set(sorted[0].id);
        }
      },
      error: () => this.loading.set(false)
    });
    this.chatSvc.conversations$.subscribe(c => {
      const sorted = [...c].sort((a, b) =>
        new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
      );
      this.conversations.set(sorted);
    });
  }
}
