import { Component, inject, signal, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';
import { StorageService } from '../../../../core/services/storage.service';
import { DocumentUploadService } from '../../../../core/services/document-upload.service';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

interface VerificationState {
  selfieUrl: string | null;
  idDocumentUrl: string | null;
  selfieDocumentId: number | null;
  idDocumentId: number | null;
  uploading: boolean;
  verificationInitiated: boolean;
  verificationStatus: 'IDLE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING';
  confidenceScore: number | null;
  retryCount: number;
  maxRetries: number;
  
  // Face preview
  selfieFacePreview: string | null;
  idFacePreview: string | null;
  loadingPreview: boolean;
  facePreviewError: string | null;
}

@Component({
  selector: 'app-document-verification',
  standalone: true,
  imports: [CommonModule, RouterLink],
  templateUrl: './document-verification.component.html',
})
export class DocumentVerificationComponent implements OnInit, OnDestroy {
  private http    = inject(HttpClient);
  private auth    = inject(AuthService);
  private storage = inject(StorageService);
  private router  = inject(Router);
  private uploadService = inject(DocumentUploadService);
  private readonly api = environment.apiUrl;
  private readonly destroy$ = new Subject<void>();
  private statusCheckTimeout: any;

  step      = signal<'upload' | 'preview' | 'verifying' | 'approved' | 'rejected'>('upload');
  loading   = signal(false);
  error     = signal('');

  state: VerificationState = {
    selfieUrl: null,
    idDocumentUrl: null,
    selfieDocumentId: null,
    idDocumentId: null,
    uploading: false,
    verificationInitiated: false,
    verificationStatus: 'IDLE',
    confidenceScore: null,
    retryCount: 0,
    maxRetries: 3,
    selfieFacePreview: null,
    idFacePreview: null,
    loadingPreview: false,
    facePreviewError: null,
  };

  private docFile: File | null   = null;
  private selfieFile: File | null = null;

  ngOnInit(): void {
    const user = this.storage.user();
    
    // Solo redirigir automáticamente si ya es ACTIVE y NO es proveedor (o si es proveedor ya aprobado)
    // Los proveedores que necesitan verificar deben poder entrar aquí incluso si su user.status es ACTIVE
    if (user?.status === 'ACTIVE' && user?.role !== 'PROVIDER') {
      const target = user.role === 'CLIENT' ? '/client/tabs' : '/provider/tabs';
      this.router.navigate([target], { replaceUrl: true });
      return;
    }

    // Verificar status fresco desde la API
    this.http.get<any>(`${this.api}/providers/me`).subscribe({
      next: (profile) => {
        if (profile.validation_status === 'approved') {
          const u = this.storage.user()!;
          this.storage.setUser({ ...u, status: 'ACTIVE' });
          this.router.navigate(['/provider/tabs'], { replaceUrl: true });
        }
      },
      error: (err) => {
        if (err.status === 404) {
          // Si es un socio nuevo sin perfil, permitimos que verifique igual
          console.log('Provider profile not found, allowing document verification');
        }
      }
    });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
    if (this.statusCheckTimeout) {
      clearTimeout(this.statusCheckTimeout);
    }
  }

  onDocumentSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.docFile = file;
    const reader = new FileReader();
    reader.onload = (e) => this.state.idDocumentUrl = e.target?.result as string;
    reader.readAsDataURL(file);
  }

  onSelfieSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.selfieFile = file;
    const reader = new FileReader();
    reader.onload = (e) => this.state.selfieUrl = e.target?.result as string;
    reader.readAsDataURL(file);
  }

  /**
   * Upload selfie with validation
   */
  async uploadSelfie(): Promise<void> {
    if (!this.selfieFile) {
      this.error.set('Selecciona una selfie.');
      return;
    }

    try {
      this.state.uploading = true;
      this.error.set('');

      const result = await firstValueFrom(
        this.uploadService.uploadDocument(this.selfieFile, 'SELFIE')
      );
      
      this.state.selfieDocumentId = result.id;
      console.log('✅ Selfie uploaded successfully:', result.id);
    } catch (err: any) {
      console.error('Selfie upload failed:', err);
      this.error.set(err?.error?.detail || err?.message || 'Error al subir selfie');
    } finally {
      this.state.uploading = false;
    }
  }

  /**
   * Upload ID document with validation
   */
  async uploadIdDocument(): Promise<void> {
    if (!this.docFile) {
      this.error.set('Selecciona tu documento de identidad.');
      return;
    }

    try {
      this.state.uploading = true;
      this.error.set('');

      const result = await firstValueFrom(
        this.uploadService.uploadDocument(this.docFile, 'IDENTITY_DOCUMENT')
      );
      
      this.state.idDocumentId = result.id;
      console.log('✅ ID document uploaded successfully:', result.id);

      // Si ambos documentos están listos, cargar preview
      if (this.state.selfieDocumentId && this.state.idDocumentId) {
        await this.loadFacePreview();
      }
    } catch (err: any) {
      console.error('ID document upload failed:', err);
      this.error.set(err?.error?.detail || err?.message || 'Error al subir documento');
    } finally {
      this.state.uploading = false;
    }
  }

  /**
   * Load face preview (FIX ERROR 431: Convert base64 to Data URL)
   */
  async loadFacePreview(): Promise<void> {
    if (!this.state.selfieDocumentId || !this.state.idDocumentId) {
      return;
    }

    try {
      this.state.loadingPreview = true;
      this.state.facePreviewError = null;

      const result = await firstValueFrom(
        this.uploadService.getFacePreview(
          this.state.selfieDocumentId,
          this.state.idDocumentId
        )
      );

      if (result) {
        // FIX ERROR 431: Add Data URL prefix to base64 strings
        this.state.selfieFacePreview = result.selfie_preview 
          ? `data:image/jpeg;base64,${result.selfie_preview}` 
          : null;
        this.state.idFacePreview = result.id_preview 
          ? `data:image/jpeg;base64,${result.id_preview}` 
          : null;

        const facesDetected = result.success && 
          this.state.selfieFacePreview && 
          this.state.idFacePreview;
        
        if (facesDetected) {
          console.log('✅ Face preview loaded successfully');
          this.step.set('preview');
        } else {
          const errorMsg = result.error || 'No se pudieron detectar rostros';
          const isAwsConfigError = [
            'AWS_ACCESS_KEY_ID',
            'UnrecognizedClientException',
            'security token',
          ].some(token => errorMsg.includes(token));
          
          if (!isAwsConfigError) {
            this.state.facePreviewError = errorMsg;
          }
          console.warn('Face preview no disponible:', errorMsg);
        }
      }
    } catch (err: any) {
      console.warn('Failed to load face preview:', err);
      const errorMessage = err?.error?.detail || err?.message || 'Error';
      const isAwsConfigError = [
        'AWS_ACCESS_KEY_ID',
        'UnrecognizedClientException',
        'security token',
      ].some(token => errorMessage.includes(token));
      
      if (!isAwsConfigError) {
        this.state.facePreviewError = `Error: ${errorMessage}`;
      }
    } finally {
      this.state.loadingPreview = false;
    }
  }

  /**
   * Submit documents for upload and preview
   */
  async submit(): Promise<void> {
    if (!this.docFile || !this.selfieFile) {
      this.error.set('Debes subir el documento y la selfie.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    // Upload both documents
    await this.uploadSelfie();
    if (this.state.selfieDocumentId) {
      await this.uploadIdDocument();
    }

    this.loading.set(false);

    // If face preview loaded successfully, advance to preview step
    if (this.state.selfieFacePreview && this.state.idFacePreview) {
      this.step.set('preview');
    }
  }

  /**
   * Initiate face verification
   */
  async initiateVerification(): Promise<void> {
    if (!this.state.selfieDocumentId || !this.state.idDocumentId) {
      this.error.set('Debe subir selfie y documento de identidad');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.step.set('verifying');

    try {
      const result = await firstValueFrom(
        this.uploadService.initiateVerification(
          this.state.selfieDocumentId,
          this.state.idDocumentId
        )
      );
      
      this.state.verificationInitiated = true;
      
      if (result && result.face_match_status) {
        this.state.verificationStatus = result.face_match_status;
        
        if (result.face_match_status === 'APPROVED') {
          this.step.set('approved');
          this.state.confidenceScore = parseFloat(result.face_match_score || '0');
        } else if (result.face_match_status === 'REJECTED') {
          this.step.set('rejected');
          this.state.confidenceScore = parseFloat(result.face_match_score || '0');
        } else if (result.face_match_status === 'PROCESSING') {
          this.state.verificationStatus = 'PROCESSING';
          this.scheduleStatusCheck();
        } else {
          // PENDING
          this.scheduleStatusCheck();
        }
      }
    } catch (err: any) {
      console.error('Verification initiation failed:', err);
      this.error.set('Error al iniciar verificación. Intenta nuevamente.');
      this.step.set('preview');
    } finally {
      this.loading.set(false);
    }
  }

  /**
   * Schedule status check after 5 seconds
   */
  private scheduleStatusCheck(): void {
    if (this.statusCheckTimeout) {
      clearTimeout(this.statusCheckTimeout);
    }

    this.statusCheckTimeout = setTimeout(() => {
      this.checkVerificationStatus();
    }, 5000);
  }

  /**
   * Retry with exponential backoff
   */
  private retryWithExponentialBackoff(): void {
    if (this.state.retryCount < this.state.maxRetries) {
      this.state.retryCount++;
      const delayMs = 2000 * Math.pow(2, this.state.retryCount - 1);
      
      this.statusCheckTimeout = setTimeout(() => {
        this.checkVerificationStatus();
      }, delayMs);
    } else {
      this.state.verificationStatus = 'REJECTED';
      this.step.set('rejected');
      this.error.set('No se pudo completar la verificación. Intenta nuevamente.');
    }
  }

  /**
   * Check verification status
   */
  private checkVerificationStatus(): void {
    this.uploadService
      .getVerificationStatus()
      .pipe(takeUntil(this.destroy$))
      .subscribe({
        next: (status) => {
          if (!status) {
            this.state.verificationStatus = 'IDLE';
            return;
          }

          this.state.verificationStatus = status.face_match_status;
          
          if (status.face_match_score) {
            this.state.confidenceScore = Number.parseFloat(status.face_match_score);
          }

          if (status.face_match_status === 'APPROVED') {
            this.step.set('approved');
            if (this.statusCheckTimeout) {
              clearTimeout(this.statusCheckTimeout);
            }
          } else if (status.face_match_status === 'REJECTED') {
            this.step.set('rejected');
            if (this.statusCheckTimeout) {
              clearTimeout(this.statusCheckTimeout);
            }
          } else if (status.face_match_status === 'PENDING') {
            this.retryWithExponentialBackoff();
          }
        },
        error: (err) => {
          console.error('Status check failed:', err);
          this.retryWithExponentialBackoff();
        },
      });
  }

  /**
   * Continue to dashboard (when approved)
   */
  continueToDashboard(): void {
    const currentUser = this.storage.user();
    
    if (!currentUser) {
      console.error('No hay usuario autenticado');
      return;
    }

    if (this.state.verificationStatus === 'APPROVED') {
      console.log('✅ Verificación aprobada, actualizando status a ACTIVE');
      
      const updatedUser = {
        ...currentUser,
        status: 'ACTIVE' as const
      };
      
      this.storage.setUser(updatedUser);
      this.router.navigate(['/provider/tabs'], { replaceUrl: true });
    }
  }

  /**
   * Retry verification (when rejected)
   */
  retryVerification(): void {
    // Reset state
    this.state = {
      selfieUrl: null,
      idDocumentUrl: null,
      selfieDocumentId: null,
      idDocumentId: null,
      uploading: false,
      verificationInitiated: false,
      verificationStatus: 'IDLE',
      confidenceScore: null,
      retryCount: 0,
      maxRetries: 3,
      selfieFacePreview: null,
      idFacePreview: null,
      loadingPreview: false,
      facePreviewError: null,
    };
    
    this.docFile = null;
    this.selfieFile = null;
    this.step.set('upload');
    this.error.set('');
  }

  logout(): void {
    this.auth.logout();
  }
}
