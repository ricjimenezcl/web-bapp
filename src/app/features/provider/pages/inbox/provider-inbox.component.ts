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
  template: `
    <div class="flex flex-col h-full">
      <header class="bg-white border-b border-surface-200 px-4 py-4 sticky top-0 z-10">
        <h1 class="text-lg font-bold text-slate-800">Mensajes</h1>
      </header>
      <div class="flex-1 overflow-y-auto">
        @if (loading()) {
          <div class="p-4"><app-loading-skeleton [count]="4"></app-loading-skeleton></div>
        } @else if (conversations().length === 0) {
          <app-empty-state icon="💬" title="Sin mensajes" description="Cuando un cliente te contacte, aparecerá aquí."></app-empty-state>
        } @else {
          <div class="divide-y divide-surface-100">
            @for (conv of conversations(); track conv.id) {
              <a [routerLink]="['/provider/chat', conv.id]" class="flex items-center gap-3 px-4 py-3.5 hover:bg-surface-50">
                <div class="relative shrink-0">
                  <div class="w-12 h-12 rounded-full bg-primary-100 flex items-center justify-center text-lg">👤</div>
                  @if ((conv.unread_count ?? 0) > 0) {
                    <span class="absolute -top-0.5 -right-0.5 w-5 h-5 bg-danger text-white text-[10px] font-bold rounded-full flex items-center justify-center">
                      {{ conv.unread_count }}
                    </span>
                  }
                </div>
                <div class="flex-1 min-w-0">
                  <div class="flex items-center justify-between">
                    <h3 class="font-semibold text-slate-800 truncate text-sm">{{ conv.display_name ?? 'Cliente' }}</h3>
                    <span class="text-xs text-slate-400 ml-2">{{ conv.updated_at | date:'HH:mm' }}</span>
                  </div>
                  @if (conv.last_message_preview) {
                    <p class="text-xs text-slate-500 truncate mt-0.5">{{ conv.last_message_preview }}</p>
                  }
                </div>
              </a>
            }
          </div>
        }
      </div>
    </div>
  `
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
