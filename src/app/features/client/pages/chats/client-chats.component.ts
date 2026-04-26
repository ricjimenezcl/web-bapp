import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChatService } from '../../../../core/services/chat.service';
import { ConversationUI } from '../../../../core/models/chat.model';

@Component({
  selector: 'app-client-chats',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './client-chats.component.html',
  styleUrl: './client-chats.component.scss',
})
export class ClientChatsComponent implements OnInit {
  private chatSvc = inject(ChatService);
  conversations = signal<ConversationUI[]>([]);
  loading = signal(true);

  ngOnInit(): void {
    this.chatSvc.loadConversations().subscribe({
      next: (list) => { this.conversations.set(list); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
    this.chatSvc.conversations$.subscribe(c => this.conversations.set(c));
  }
}
