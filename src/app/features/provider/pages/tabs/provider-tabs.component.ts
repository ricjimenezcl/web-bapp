import { Component, inject, signal, computed, OnInit, OnDestroy, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, RouterLinkActive, Router } from '@angular/router';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { NotificationStateService } from '../../../../core/services/notification-state.service';
import { ChatService } from '../../../../core/services/chat.service';
import { ProviderService } from '../../../../core/services/provider.service';
import { ProviderProfile } from '../../../../core/models/provider.model';
import { Subscription } from 'rxjs';

@Component({
  selector: 'app-provider-tabs',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, RouterLinkActive],
  templateUrl: './provider-tabs.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA],
})
export class ProviderTabsComponent implements OnInit, OnDestroy {
  private ws     = inject(WebSocketService);
  private notif  = inject(NotificationStateService);
  private chat   = inject(ChatService);
  private providerSvc = inject(ProviderService);
  private router = inject(Router);
  
  readonly unread = this.notif.unreadCount;
  readonly profile = signal<ProviderProfile | null>(null);
  readonly firstName = computed(() => this.profile()?.full_name?.trim().split(/\s+/)[0] ?? '');
  sidebarOpen = signal(false);
  private subs: Subscription[] = [];

  toggleSidebar(): void { this.sidebarOpen.update(v => !v); }
  closeSidebar():  void { this.sidebarOpen.set(false); }

  goToAddService(): void {
    this.router.navigate(['/provider/add-service']);
    this.closeSidebar();
  }

  ngOnInit(): void {
    this.ws.connect();
    this.notif.loadNotifications();
    this.providerSvc.getMyProfile().subscribe({
      next: (p) => this.profile.set(p),
      error: () => {}
    });
    this.subs.push(
      this.ws.notification$.subscribe(n => {
        this.notif.addNotification({
          id: n.notification_id, user_id: 0,
          notification_type: n.notification_type as any,
          title: n.title, content: n.content,
          related_entity_id: n.related_entity_id,
          related_entity_type: n.related_entity_type,
          is_read: n.is_read, created_at: n.timestamp,
        });
        if ((n.notification_type === 'message' || n.notification_type === 'chat_message') && n.related_entity_id) {
          this.chat.applyLocalMessageUpdate(n.related_entity_id, n.content);
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
