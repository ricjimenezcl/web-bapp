import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink } from '@angular/router';
import { ChatService } from '../../../../core/services/chat.service';
import { ConversationUI } from '../../../../core/models/chat.model';
import { EmptyStateComponent } from '../../../../shared/components/empty-state/empty-state.component';
import { LoadingSkeletonComponent } from '../../../../shared/components/loading-skeleton/loading-skeleton.component';

@Component({
  selector: 'app-provider-inbox',
  standalone: true,
  imports: [CommonModule, RouterLink, EmptyStateComponent, LoadingSkeletonComponent],
  templateUrl: './provider-inbox.component.html',
  styleUrl: './provider-inbox.component.scss',
})
export class ProviderInboxComponent implements OnInit {
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
