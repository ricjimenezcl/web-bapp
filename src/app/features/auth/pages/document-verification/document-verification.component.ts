import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
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
  @ViewChild('videoElement') videoElement!: ElementRef<HTMLVideoElement>;
  @ViewChild('canvasElement') canvasElement!: ElementRef<HTMLCanvasElement>;

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
  
  // Camera and Liveness state
  isCameraActive = signal(false);
  cameraMode     = signal<'user' | 'environment'>('user'); // user=selfie, environment=document
  activeCapture  = signal<'selfie' | 'document' | null>(null);
  stream: MediaStream | null = null;

  // Liveness Logic
  livenessStep = signal<'READY' | 'CENTER' | 'TURN_RIGHT' | 'TURN_LEFT' | 'PROCESSING' | 'COMPLETE'>('READY');
  livenessInstruction = signal('Centra tu rostro en el óvalo');
  faceDetected = signal(false);
  faceStableTime = 0;
  requiredStableTime = 2000; // 2 segundos para captura
  ovalOffsetX = signal(0);
  ovalOffsetY = signal(0);
  ovalScale = signal(1); // Para adaptar el tamaño si es necesario
  initialFaceX: number | null = null;
  headTurnDetected = false;
  
  private faceDetectionInterval?: any;
  private lastCheckTime = 0;

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
    this.stopCamera();
    this.destroy$.next();
    this.destroy$.complete();
    if (this.statusCheckTimeout) {
      clearTimeout(this.statusCheckTimeout);
    }
  }

  async startCamera(type: 'selfie' | 'document') {
    this.activeCapture.set(type);
    this.cameraMode.set(type === 'selfie' ? 'user' : 'environment');
    this.isCameraActive.set(true);
    this.error.set('');
    this.faceStableTime = 0;
    this.headTurnDetected = false;
    this.initialFaceX = null;

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.cameraMode(),
          width: { ideal: 1280 },
          height: { ideal: 720 }
        },
        audio: false
      });

      // Pequeño delay para asegurar que el ViewChild esté disponible si se acaba de mostrar
      setTimeout(() => {
        if (this.videoElement) {
          this.videoElement.nativeElement.srcObject = this.stream;
          this.videoElement.nativeElement.play();
          
          if (type === 'selfie') {
            this.startLivenessDetection();
          }
        }
      }, 100);
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      this.error.set('No se pudo acceder a la cámara. Por favor verifica los permisos.');
      this.isCameraActive.set(false);
    }
  }

  stopCamera() {
    this.stopLivenessDetection();
    if (this.stream) {
      this.stream.getTracks().forEach(track => track.stop());
      this.stream = null;
    }
    this.isCameraActive.set(false);
    this.activeCapture.set(null);
  }

  private startLivenessDetection() {
    this.livenessStep.set('CENTER');
    this.livenessInstruction.set('Coloca tu rostro dentro del óvalo');
    this.lastCheckTime = Date.now();
    
    this.faceDetectionInterval = setInterval(() => {
      this.performDetectionCycle();
    }, 150);
  }

  private stopLivenessDetection() {
    if (this.faceDetectionInterval) {
      clearInterval(this.faceDetectionInterval);
      this.faceDetectionInterval = undefined;
    }
  }

  private performDetectionCycle() {
    const video = this.videoElement?.nativeElement;
    const canvas = this.canvasElement?.nativeElement;
    if (!video || !canvas || video.paused) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const face = this.findFaceRegion(ctx, canvas.width, canvas.height);
    const now = Date.now();
    const delta = now - this.lastCheckTime;
    this.lastCheckTime = now;

    if (face && face.confidence > 0.3) {
      this.faceDetected.set(true);
      
      // Suavizado de movimiento del óvalo
      const targetX = face.centerX - canvas.width / 2;
      const targetY = face.centerY - canvas.height / 2;
      this.ovalOffsetX.update(v => v + (targetX - v) * 0.3);
      this.ovalOffsetY.update(v => v + (targetY - v) * 0.3);

      // Adaptar tamaño basado en el área detectada (estimación simple)
      // Si el rostro está muy cerca, aumentar escala
      if (face.area) {
        const idealArea = (canvas.width * canvas.height) * 0.15;
        const scale = Math.sqrt(face.area / idealArea);
        this.ovalScale.set(Math.max(0.8, Math.min(1.2, scale)));
      }

      this.processLivenessSteps(delta);
    } else {
      this.faceDetected.set(false);
      this.faceStableTime = 0;
      if (this.livenessStep() !== 'COMPLETE') {
        this.livenessInstruction.set('No se detecta tu rostro. Asegúrate de tener buena luz.');
      }
    }
  }

  private processLivenessSteps(delta: number) {
    const currentStep = this.livenessStep();

    if (currentStep === 'CENTER') {
      this.faceStableTime += delta;
      const remaining = Math.ceil((this.requiredStableTime - this.faceStableTime) / 1000);
      
      if (remaining > 0) {
        this.livenessInstruction.set(`Mantente quieto... ${remaining}s`);
      } else {
        this.initialFaceX = this.ovalOffsetX();
        this.livenessStep.set('TURN_RIGHT');
        this.faceStableTime = 0;
        this.livenessInstruction.set('👉 Gira un poco la cabeza a la DERECHA');
      }
    } 
    else if (currentStep === 'TURN_RIGHT') {
      const displacement = this.ovalOffsetX() - (this.initialFaceX || 0);
      // En modo espejo, girar a la derecha física mueve el rostro a la IZQUIERDA en el video
      if (displacement < -40) {
        this.headTurnDetected = true;
        this.livenessStep.set('TURN_LEFT');
        this.livenessInstruction.set('👈 Ahora gira a la IZQUIERDA');
      }
    }
    else if (currentStep === 'TURN_LEFT') {
      const displacement = this.ovalOffsetX() - (this.initialFaceX || 0);
      if (displacement > 40) {
        this.livenessStep.set('COMPLETE');
        this.livenessInstruction.set('¡Perfecto! Capturando...');
        setTimeout(() => this.capturePhoto(), 500);
      }
    }
  }

  private findFaceRegion(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // Escaneo simplificado: buscamos tonos de piel en una rejilla
    const step = 40;
    let totalX = 0, totalY = 0, count = 0;
    let minX = width, maxX = 0, minY = height, maxY = 0;

    for (let y = height * 0.2; y < height * 0.8; y += step) {
      for (let x = width * 0.2; x < width * 0.8; x += step) {
        const pixel = ctx.getImageData(x, y, 1, 1).data;
        const r = pixel[0], g = pixel[1], b = pixel[2];
        
        // Regla básica de tono de piel
        if (r > 95 && g > 40 && b > 20 && r > g && r > b && Math.abs(r - g) > 15) {
          totalX += x;
          totalY += y;
          count++;
          if (x < minX) minX = x;
          if (x > maxX) maxX = x;
          if (y < minY) minY = y;
          if (y > maxY) maxY = y;
        }
      }
    }

    if (count < 10) return null;

    return {
      centerX: totalX / count,
      centerY: totalY / count,
      confidence: count / 100,
      area: (maxX - minX) * (maxY - minY)
    };
  }

  capturePhoto() {
    if (!this.videoElement || !this.canvasElement) return;

    const video = this.videoElement.nativeElement;
    const canvas = this.canvasElement.nativeElement;
    const context = canvas.getContext('2d');

    if (context) {
      canvas.width = video.videoWidth;
      canvas.height = video.videoHeight;
      context.drawImage(video, 0, 0, canvas.width, canvas.height);

      // Verificación básica de calidad para documentos
      if (this.activeCapture() === 'document') {
        const imageData = context.getImageData(0, 0, canvas.width, canvas.height).data;
        let brightness = 0;
        for (let i = 0; i < imageData.length; i += 40) { // Muestreo rápido
          brightness += (imageData[i] + imageData[i+1] + imageData[i+2]) / 3;
        }
        const avgBrightness = brightness / (imageData.length / 40);
        
        if (avgBrightness < 30) {
          this.error.set('La imagen está demasiado oscura. Busca un lugar con mejor iluminación.');
          return;
        }
        if (avgBrightness > 230) {
          this.error.set('La imagen tiene demasiado brillo o reflejo. Intenta otro ángulo.');
          return;
        }
      }

      canvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `${this.activeCapture()}_${Date.now()}.jpg`, { type: 'image/jpeg' });
          if (this.activeCapture() === 'selfie') {
            this.selfieFile = file;
            this.state.selfieUrl = URL.createObjectURL(file);
            this.uploadSelfie();
          } else {
            this.docFile = file;
            this.state.idDocumentUrl = URL.createObjectURL(file);
            this.uploadIdDocument();
          }
          this.stopCamera();
        }
      }, 'image/jpeg', 0.9);
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
      this.error.set('Primero captura tu selfie.');
      return;
    }

    try {
      this.state.uploading = true;
      this.error.set('');

      const result = await firstValueFrom(
        this.uploadService.uploadDocument(this.selfieFile, 'SELFIE')
      );
      
      this.state.selfieDocumentId = result.id;
      console.log('✅ Selfie subida con éxito:', result.id);
    } catch (err: any) {
      console.error('Selfie upload failed:', err);
      this.error.set('No pudimos identificar un rostro válido en la selfie. Asegúrate de mirar de frente a la cámara.');
    } finally {
      this.state.uploading = false;
    }
  }

  /**
   * Upload ID document with validation
   */
  async uploadIdDocument(): Promise<void> {
    if (!this.docFile) {
      this.error.set('Primero captura tu documento de identidad.');
      return;
    }

    try {
      this.state.uploading = true;
      this.error.set('');

      const result = await firstValueFrom(
        this.uploadService.uploadDocument(this.docFile, 'IDENTITY_DOCUMENT')
      );
      
      this.state.idDocumentId = result.id;
      console.log('✅ Documento subido con éxito:', result.id);

      // Si ambos documentos están listos, cargar preview
      if (this.state.selfieDocumentId && this.state.idDocumentId) {
        await this.loadFacePreview();
      }
    } catch (err: any) {
      console.error('ID document upload failed:', err);
      this.error.set('No se reconoció el documento de identidad. Asegúrate de capturar el frente de tu cédula de forma legible.');
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
