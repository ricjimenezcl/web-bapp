import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { AuthService } from '../../../../core/services/auth.service';
import { ProfileService } from '../../../../core/services/profile.service';
import { UserProfile } from '../../../../core/models/user.model';

@Component({
  selector: 'app-client-profile',
  standalone: true,
  imports: [CommonModule],
  templateUrl: './client-profile.component.html',
  styleUrl: './client-profile.component.scss',
})
export class ClientProfileComponent implements OnInit {
  private readonly auth    = inject(AuthService);
  private readonly profile = inject(ProfileService);
  private readonly router  = inject(Router);

  user    = signal<UserProfile | null>(null);
  loading = signal(true);

  ngOnInit(): void {
    const stored = this.auth.currentProfile();
    if (stored) { this.user.set(stored); this.loading.set(false); }
    this.profile.getMe().subscribe({
      next: (p) => { this.user.set(p); this.loading.set(false); },
      error: () => this.loading.set(false)
    });
  }

  goToEditProfile(): void {
    this.router.navigate(['/client/edit-profile']);
  }

  goToTransactions(): void {
    this.router.navigate(['/transactions']);
  }

  goToCatalog(): void {
    this.router.navigate(['/product-catalog']);
  }

  goToSettings(): void {
    this.router.navigate(['/client/settings']);
  }

  goToTerms(): void {
    this.router.navigate(['/terms']);
  }

  async inviteFriends(): Promise<void> {
    const user = this.auth.currentUser();
    if (!user?.id) return;

    const inviteUrl = `https://bapp.app/invite/${user.id}`;
    const shareData = {
      title: 'Únete a BAPP',
      text: 'Descarga BAPP y encuentra los mejores servicios cerca de ti.',
      url: inviteUrl
    };

    // Use native share API if available (mobile)
    if (navigator.share && navigator.canShare?.(shareData)) {
      try {
        await navigator.share(shareData);
      } catch {
        // User cancelled share - this is expected behavior
        console.log('Share cancelled or not supported');
      }
    } else {
      // Fallback: copy to clipboard
      try {
        await navigator.clipboard.writeText(inviteUrl);
        alert('Enlace copiado al portapapeles');
      } catch {
        alert('No se pudo copiar el enlace');
      }
    }
  }

  async goLogout(): Promise<void> {
    const confirmed = confirm('¿Estás seguro de que deseas cerrar sesión?');
    if (confirmed) {
      this.auth.logout();
      this.router.navigate(['/auth/login']);
    }
  }
}
