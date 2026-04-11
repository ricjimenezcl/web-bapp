import { Component, inject, signal, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';
import { StorageService } from '../../../../core/services/storage.service';

@Component({
  selector: 'app-document-verification',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './document-verification.component.html',
})
export class DocumentVerificationComponent implements OnInit {
  private http    = inject(HttpClient);
  private auth    = inject(AuthService);
  private storage = inject(StorageService);
  private router  = inject(Router);
  private readonly api = environment.apiUrl;

  step      = signal<'document' | 'selfie' | 'reviewing' | 'done' | 'rejected'>('document');
  loading   = signal(false);
  error     = signal('');
  docPreview   = signal<string | null>(null);
  selfiePreview = signal<string | null>(null);

  private docFile: File | null   = null;
  private selfieFile: File | null = null;

  ngOnInit(): void {
    // Si ya está ACTIVE en storage, ir directo a tabs
    if (this.storage.user()?.status === 'ACTIVE') {
      this.router.navigate(['/provider/tabs'], { replaceUrl: true });
      return;
    }
    // Verificar status fresco desde la API (por si fue aprobado desde otro lado)
    this.http.get<any>(`${this.api}/providers/me`).subscribe({
      next: (profile) => {
        if (profile.status === 'ACTIVE') {
          const u = this.storage.user()!;
          this.storage.setUser({ ...u, status: 'ACTIVE' });
          this.router.navigate(['/provider/tabs'], { replaceUrl: true });
        }
      },
      error: () => {}
    });
  }

  onDocumentSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.docFile = file;
    const reader = new FileReader();
    reader.onload = (e) => this.docPreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  onSelfieSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selfieFile = file;
    const reader = new FileReader();
    reader.onload = (e) => this.selfiePreview.set(e.target?.result as string);
    reader.readAsDataURL(file);
  }

  nextToSelfie(): void {
    if (!this.docFile) { this.error.set('Selecciona un documento de identidad.'); return; }
    this.error.set('');
    this.step.set('selfie');
  }

  submit(): void {
    if (!this.docFile || !this.selfieFile) {
      this.error.set('Debes subir el documento y la selfie.');
      return;
    }
    this.loading.set(true);
    this.error.set('');

    const formData = new FormData();
    const providerId = this.storage.user()?.provider_id;
    if (providerId) formData.append('provider_id', String(providerId));
    formData.append('identity_document', this.docFile);
    formData.append('selfie', this.selfieFile);

    this.http.post(`${this.api}/providers/validate-identity`, formData).subscribe({
      next: () => {
        this.loading.set(false);
        this.step.set('reviewing');
      },
      error: (err) => {
        this.loading.set(false);
        this.error.set(err?.error?.detail ?? 'Error al enviar documentos.');
      }
    });
  }

  logout(): void {
    this.auth.logout();
  }
}
