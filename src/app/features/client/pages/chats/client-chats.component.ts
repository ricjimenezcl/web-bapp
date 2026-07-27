import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ChatService } from '../../../../core/services/chat.service';
import { ConversationUI } from '../../../../core/models/chat.model';
import { ChatViewComponent } from '../../../../features/chat/chat-view.component';
import { DatePipe } from '@angular/common';
import { PlatformI18nService } from '../../../../core/services/platform-i18n.service';
import { TPipe } from '../../../../shared/pipes/t.pipe';

@Component({
  selector: 'app-client-chats',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, ChatViewComponent, TPipe],
  templateUrl: './client-chats.component.html',
  styleUrl: './client-chats.component.scss',
})
export class ClientChatsComponent implements OnInit {
  private chatSvc = inject(ChatService);
  private i18n = inject(PlatformI18nService);
  conversations = signal<ConversationUI[]>([]);
  loading = signal(true);
  selectedConvId = signal<number | null>(null);
  searchText = '';

  get filteredConversations(): ConversationUI[] {
    const search = this.searchText.toLowerCase().trim();
    const convs = this.conversations();
    if (!search) return convs;
    return convs.filter(c =>
      (c.display_name ?? '').toLowerCase().includes(search)
    );
  }

  ngOnInit(): void {
    this.loadConversations();
  }

  loadConversations(): void {
    this.loading.set(true);
    this.chatSvc.loadAllConversations().subscribe({
      next: (list) => {
        const sorted = [...list].sort((a, b) =>
          new Date(b.updated_at ?? 0).getTime() - new Date(a.updated_at ?? 0).getTime()
        );
        this.conversations.set(sorted);
        if (!this.selectedConvId() && sorted.length > 0) {
          this.selectedConvId.set(sorted[0].id);
        }
        this.loading.set(false);
      },
      error: (err) => {
        console.error('Error loading conversations:', err);
        this.loading.set(false);
      }
    });
  }

  selectChat(id: number): void {
    console.log('Selecting chat:', id);
    this.selectedConvId.set(id);
  }

  closeChat(): void {
    this.selectedConvId.set(null);
  }

  deleteConversation(id: number, event: Event): void {
    event.stopPropagation();
    if (!confirm(this.i18n.t('chat.deleteConversationConfirm'))) return;
    this.chatSvc.deleteConversation(id).subscribe({
      next: () => {
        this.chatSvc.removeConversationLocally(id);
        this.conversations.update(list => list.filter(c => c.id !== id));
        if (this.selectedConvId() === id) this.selectedConvId.set(null);
      },
      error: () => {}
    });
  }

  isNow(date: string | Date | undefined): boolean {
    if (!date) return false;
    const d = new Date(date);
    const now = new Date();
    return d.toDateString() === now.toDateString() &&
      d.getHours() === now.getHours() &&
      d.getMinutes() === now.getMinutes();
  }
}
