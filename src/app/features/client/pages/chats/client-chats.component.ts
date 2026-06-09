import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Subscription } from 'rxjs';
import { ChatService } from '../../../../core/services/chat.service';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { ConversationUI } from '../../../../core/models/chat.model';
import { ChatViewComponent } from '../../../../features/chat/chat-view.component';

@Component({
  selector: 'app-client-chats',
  standalone: true,
  imports: [CommonModule, FormsModule, DatePipe, ChatViewComponent],
  templateUrl: './client-chats.component.html',
  styleUrl: './client-chats.component.scss',
})
export class ClientChatsComponent implements OnInit, OnDestroy {
  private chatSvc = inject(ChatService);
  private ws = inject(WebSocketService);
  conversations = signal<ConversationUI[]>([]);
  loading = signal(true);
  selectedConvId = signal<number | null>(null);
  searchText = '';
  private subs: Subscription[] = [];

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

  loadConversations(): void {
    this.loading.set(true);
    this.chatSvc.loadConversations().subscribe({
      next: (list) => {
        console.log('Conversations loaded:', list);
        this.conversations.set(list);
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

  isNow(date: string | Date | undefined): boolean {
    if (!date) return false;
    const d = new Date(date);
    const now = new Date();
    return d.toDateString() === now.toDateString() &&
      d.getHours() === now.getHours() &&
      d.getMinutes() === now.getMinutes();
  }
}
