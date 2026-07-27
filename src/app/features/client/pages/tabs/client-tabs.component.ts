import { Component, inject, OnInit, OnDestroy, signal, computed, CUSTOM_ELEMENTS_SCHEMA } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterLink, RouterOutlet, RouterLinkActive, Router } from '@angular/router';
import { WebSocketService } from '../../../../core/services/websocket.service';
import { NotificationStateService } from '../../../../core/services/notification-state.service';
import { ChatService } from '../../../../core/services/chat.service';
import { AuthService } from '../../../../core/services/auth.service';
import { Subscription } from 'rxjs';
import { TPipe } from '../../../../shared/pipes/t.pipe';

@Component({
  selector: 'app-client-tabs',
  standalone: true,
  imports: [CommonModule, RouterLink, RouterOutlet, RouterLinkActive, TPipe],
  templateUrl: './client-tabs.component.html',
  schemas: [CUSTOM_ELEMENTS_SCHEMA]
})
export class ClientTabsComponent implements OnInit, OnDestroy {
  private ws     = inject(WebSocketService);
  private notif  = inject(NotificationStateService);
  private chat   = inject(ChatService);
  private auth   = inject(AuthService);
  private router = inject(Router);

  readonly unreadNotifications = this.notif.unreadCount;
  readonly currentProfile      = this.auth.currentProfile;
  readonly firstName           = computed(() => this.currentProfile()?.full_name?.trim().split(/\s+/)[0] ?? '');
  private subs: Subscription[] = [];
  
  // Sidebar state (mobile/tablet)
  sidebarOpen = signal(false);

  toggleSidebar(): void {
    this.sidebarOpen.set(!this.sidebarOpen());
  }

  closeSidebar(): void {
    this.sidebarOpen.set(false);
  }

  goToCategories(): void {
    this.router.navigate(['/client/categories']);
    this.closeSidebar(); // Close sidebar after navigation
  }

  ngOnInit(): void {
    this.ws.connect();
    this.notif.loadNotifications();

    // Cargar perfil para mostrar avatar + nombre en navbar (si no está cacheado)
    if (!this.currentProfile()) {
      this.auth.fetchProfile().subscribe({ error: () => {} });
    }

    this.subs.push(
      this.ws.notification$.subscribe(n => {
        this.notif.addNotification({
          id: n.notification_id,
          user_id: 0,
          notification_type: n.notification_type as any,
          title: n.title,
          content: n.content,
          related_entity_id: n.related_entity_id,
          related_entity_type: n.related_entity_type,
          is_read: n.is_read,
          created_at: n.timestamp,
        });

        if (n.notification_type === 'message' || n.notification_type === 'chat_message') {
          if (n.related_entity_id) {
            this.chat.applyLocalMessageUpdate(n.related_entity_id, n.content);
          }
        }
      })
    );
  }

  ngOnDestroy(): void {
    this.subs.forEach(s => s.unsubscribe());
  }
}
