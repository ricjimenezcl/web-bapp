import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute } from '@angular/router';
import { ChatService } from '../../../../core/services/chat.service';
import { ConversationUI } from '../../../../core/models/chat.model';
import { ChatViewComponent } from '../../../../features/chat/chat-view.component';
import { AppFooterComponent } from '../../../../shared/components/app-footer/app-footer.component';

@Component({
  selector: 'app-provider-inbox',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, ChatViewComponent, AppFooterComponent],
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
    this.chatSvc.conversations$.subscribe(c => this.conversations.set(c));
  }
}
