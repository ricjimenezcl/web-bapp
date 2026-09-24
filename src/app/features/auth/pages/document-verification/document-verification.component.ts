import { Component, inject, signal, OnInit, OnDestroy, ViewChild, ElementRef } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router, RouterLink } from '@angular/router';
import { HttpClient } from '@angular/common/http';
import { environment } from '../../../../../environments/environment';
import { AuthService } from '../../../../core/services/auth.service';
import { StorageService } from '../../../../core/services/storage.service';
import { DocumentUploadService, normalizeRunToDigits } from '../../../../core/services/document-upload.service';
import { Subject, firstValueFrom } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { normalizeChileanRUTForBackend } from '../../../../shared/utils/form-formatters';

export interface DocumentCaptureRectInput {
  canvasWidth: number;
  canvasHeight: number;
  videoWidth: number;
  videoHeight: number;
  videoRect: { left: number; top: number; width: number; height: number };
  guideRect: { left: number; top: number; width: number; height: number };
  marginRatio?: number;
  documentAspect?: number;
}

export function calculateDocumentCaptureRect({
  canvasWidth,
  canvasHeight,
  videoWidth,
  videoHeight,
  videoRect,
  guideRect,
  marginRatio = 0.02,
  documentAspect = 1.58,
}: DocumentCaptureRectInput) {
  const scale = Math.min(videoRect.width / Math.max(videoWidth, 1), videoRect.height / Math.max(videoHeight, 1));
  const displayedWidth = videoWidth * scale;
  const displayedHeight = videoHeight * scale;
  const offsetX = (videoRect.width - displayedWidth) / 2;
  const offsetY = (videoRect.height - displayedHeight) / 2;

  const guideLeftInDisplay = Math.max(0, guideRect.left - videoRect.left - offsetX);
  const guideTopInDisplay = Math.max(0, guideRect.top - videoRect.top - offsetY);
  const guideRightInDisplay = Math.min(displayedWidth, guideRect.left + guideRect.width - videoRect.left - offsetX);
  const guideBottomInDisplay = Math.min(displayedHeight, guideRect.top + guideRect.height - videoRect.top - offsetY);

  const sourceLeft = (guideLeftInDisplay / Math.max(displayedWidth, 1)) * videoWidth;
  const sourceTop = (guideTopInDisplay / Math.max(displayedHeight, 1)) * videoHeight;
  const sourceWidth = ((guideRightInDisplay - guideLeftInDisplay) / Math.max(displayedWidth, 1)) * videoWidth;
  const sourceHeight = ((guideBottomInDisplay - guideTopInDisplay) / Math.max(displayedHeight, 1)) * videoHeight;

  const left = Math.max(0, Math.min(videoWidth - 1, sourceLeft));
  const top = Math.max(0, Math.min(videoHeight - 1, sourceTop));
  const width = Math.max(1, Math.min(sourceWidth, videoWidth - left));
  const height = Math.max(1, Math.min(sourceHeight, videoHeight - top));

  const exactRect = {
    left: Math.round(Math.min(left, canvasWidth - 1)),
    top: Math.round(Math.min(top, canvasHeight - 1)),
    width: Math.round(Math.min(width, canvasWidth - Math.min(left, canvasWidth - 1))),
    height: Math.round(Math.min(height, canvasHeight - Math.min(top, canvasHeight - 1))),
  };

  if (guideRect.width > 0 && guideRect.height > 0) {
    return exactRect;
  }

  return exactRect;
}

interface VerificationState {
  selfieUrl: string | null;
  idDocumentFrontUrl: string | null;
  idDocumentBackUrl: string | null;
  selfieDocumentId: number | null;
  idDocumentFrontId: number | null;
  idDocumentBackId: number | null;
  uploading: boolean;
  verificationInitiated: boolean;
  verificationStatus: 'IDLE' | 'PENDING' | 'APPROVED' | 'REJECTED' | 'PROCESSING';
  confidenceScore: number | null;
  retryCount: number;
  maxRetries: number;
  
  // Face preview
  selfieFacePreview: string | null;
  idFrontFacePreview: string | null;
  loadingPreview: boolean;
  facePreviewError: string | null;
  faceDetectionFailed: boolean;
  frontRunDigits: string | null;
  rejectionReason: string | null;
  idCardValidationError: string | null;
  idCardValidated: boolean;
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
  @ViewChild('documentGuide') documentGuide!: ElementRef<HTMLDivElement>;

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
  activeCapture  = signal<'selfie' | 'documentFront' | 'documentBack' | null>(null);
  stream: MediaStream | null = null;

  // Liveness Logic
  livenessStep = signal<'READY' | 'CENTER' | 'TURN_RIGHT' | 'TURN_LEFT' | 'PROCESSING' | 'COMPLETE'>('READY');
  livenessInstruction = signal('Centra tu rostro en el óvalo');
  faceDetected = signal(false);
  faceQualityGood = signal(false); // Nuevo: indica si el rostro es de buena calidad
  faceStableTime = 0;
  requiredStableTime = 5000; // Aumentado a 5 segundos para mejor detección
  requiredStableTimeGood = 3000; // 3 segundos de buena calidad para captura manual
  ovalOffsetX = signal(0);
  ovalOffsetY = signal(0);
  ovalScale = signal(1); // Para adaptar el tamaño si es necesario
  selfieOvalWidth = signal(240);
  selfieOvalHeight = signal(340);
  initialFaceX: number | null = null;
  headTurnDetected = false;
  lastFaceArea = 0; // Guardar área anterior para suavizado
  lastFaceConfidence = 0; // Guardar confianza anterior
  
  // Document detection
  documentAligned = signal(false); // Nuevo: indica si el documento está alineado
  documentQuality = signal<'poor' | 'fair' | 'good'>('fair');
  
  // Últimas detecciones para captura
  lastFaceDetection: any = null;
  lastDocumentBounds: any = null;
  
  private faceDetectionInterval?: any;
  private lastCheckTime = 0;
  private stableQualityTime = 0; // Contador para captura manual

  state: VerificationState = {
    selfieUrl: null,
    idDocumentFrontUrl: null,
    idDocumentBackUrl: null,
    selfieDocumentId: null,
    idDocumentFrontId: null,
    idDocumentBackId: null,
    uploading: false,
    verificationInitiated: false,
    verificationStatus: 'IDLE',
    confidenceScore: null,
    retryCount: 0,
    maxRetries: 3,
    selfieFacePreview: null,
    idFrontFacePreview: null,
    loadingPreview: false,
    facePreviewError: null,
    faceDetectionFailed: false,
    frontRunDigits: null,
    rejectionReason: null,
    idCardValidationError: null,
    idCardValidated: false,
  };

  docFrontFile: File | null = null;
  docBackFile: File | null = null;
  selfieFile: File | null = null;
  rawSelfieDataUrl: string | null = null;
  selfieFallbackTried = false;

  ngOnInit(): void {
    this.updateSelfieOvalSize();
    window.addEventListener('resize', this.updateSelfieOvalSize.bind(this));

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
    window.removeEventListener('resize', this.updateSelfieOvalSize.bind(this));
    this.stopCamera();
    this.destroy$.next();
    this.destroy$.complete();
    if (this.statusCheckTimeout) {
      clearTimeout(this.statusCheckTimeout);
    }
  }

  private canCaptureFrontDocument(): boolean {
    return !!(this.selfieFile || this.state.selfieDocumentId);
  }

  private canCaptureBackDocument(): boolean {
    return !!(
      this.state.selfieDocumentId &&
      this.state.idDocumentFrontId
    );
  }

  async startCamera(type: 'selfie' | 'documentFront' | 'documentBack') {
    if (type === 'documentFront' && !this.canCaptureFrontDocument()) {
      this.error.set('Primero debes tomar y subir la selfie para continuar con el frente de la cédula.');
      return;
    }

    if (type === 'documentBack' && !this.canCaptureBackDocument()) {
      this.error.set('Primero debes subir la selfie y el frente de la cédula para poder continuar con el reverso.');
      return;
    }

    this.activeCapture.set(type);
    this.cameraMode.set(type === 'selfie' ? 'user' : 'environment');
    this.isCameraActive.set(true);
    this.error.set('');
    this.faceStableTime = 0;
    this.headTurnDetected = false;
    this.initialFaceX = null;
    
    // Reset document detection
    this.documentAligned.set(false);
    this.documentQuality.set('fair');

    try {
      this.stream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: this.cameraMode(),
          width: { ideal: 1280 },
          height: { ideal: 720 },
          aspectRatio: 1.7777777778
        },
        audio: false
      });

      // Pequeño delay para asegurar que el ViewChild esté disponible si se acaba de mostrar
      setTimeout(() => {
        if (this.videoElement) {
          this.videoElement.nativeElement.srcObject = this.stream;
          this.videoElement.nativeElement.play();
          this.updateVideoCrop();

          if (type === 'selfie') {
            this.startLivenessDetection();
          } else {
            // Para documentos, también iniciar detección
            this.startDocumentDetection();
          }
        }
      }, 100);
    } catch (err: any) {
      console.error('Error accessing camera:', err);
      this.error.set('No se pudo acceder a la cámara. Por favor verifica los permisos.');
      this.isCameraActive.set(false);
    }
  }

  private startDocumentDetection() {
    this.stopLivenessDetection();
    this.livenessStep.set('CENTER');
    this.livenessInstruction.set('Alinea el frente de tu documento');
    this.lastCheckTime = Date.now();
    this.updateVideoCrop();

    this.faceDetectionInterval = setInterval(() => {
      this.performDetectionCycle();
      this.updateVideoCrop();
    }, 150);
  }

  private updateVideoCrop() {
    const video = this.videoElement?.nativeElement as HTMLVideoElement | undefined;
    const guide = this.documentGuide?.nativeElement as HTMLDivElement | undefined;

    if (!video) return;

    if ((!guide || this.activeCapture() === 'selfie') && this.activeCapture() !== 'documentFront' && this.activeCapture() !== 'documentBack') {
      video.style.clipPath = 'none';
      return;
    }

    if (!guide) {
      video.style.clipPath = 'none';
      return;
    }

    const guideRect = guide.getBoundingClientRect();
    const videoRect = video.getBoundingClientRect();

    const left = ((guideRect.left - videoRect.left) / videoRect.width) * 100;
    const top = ((guideRect.top - videoRect.top) / videoRect.height) * 100;
    const right = 100 - ((guideRect.right - videoRect.left) / videoRect.width) * 100;
    const bottom = 100 - ((guideRect.bottom - videoRect.top) / videoRect.height) * 100;

    video.style.clipPath = `inset(${top}% ${right}% ${bottom}% ${left}% round 24px)`;
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
    this.stopLivenessDetection();
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

  private updateSelfieOvalSize(): void {
    const viewportWidth = Math.max(window.innerWidth || 390, 320);
    const viewportHeight = Math.max(window.innerHeight || 667, 480);

    const mobileMaxWidth = Math.min(viewportWidth - 36, 180);
    const mobileMaxHeight = Math.min(viewportHeight * 0.34, 220);

    if (viewportWidth <= 390) {
      const width = Math.max(140, mobileMaxWidth);
      const height = Math.max(180, Math.min(mobileMaxHeight, width * 1.28));
      this.selfieOvalWidth.set(width);
      this.selfieOvalHeight.set(height);
      return;
    }

    if (viewportWidth <= 768) {
      const width = Math.min(viewportWidth - 48, 220);
      const height = Math.min(viewportHeight * 0.42, 300);
      this.selfieOvalWidth.set(width);
      this.selfieOvalHeight.set(height);
      return;
    }

    this.selfieOvalWidth.set(260);
    this.selfieOvalHeight.set(360);
  }

  private getSelfieOvalBounds(canvasWidth: number, canvasHeight: number) {
    const viewportWidth = Math.max(window.innerWidth || canvasWidth, 320);
    const baseWidth = viewportWidth <= 390 ? 180 : viewportWidth <= 768 ? 220 : 260;
    const width = Math.min(canvasWidth * 0.62, baseWidth * 1.15);
    const height = width * 1.36;

    return {
      width: Math.max(170, width),
      height: Math.max(220, height),
      centerX: canvasWidth / 2 + this.ovalOffsetX(),
      centerY: canvasHeight / 2 + this.ovalOffsetY(),
    };
  }

  private performDetectionCycle() {
    const video = this.videoElement?.nativeElement;
    const canvas = this.canvasElement?.nativeElement;
    if (!video || !canvas || video.paused) return;
    if (!video.videoWidth || !video.videoHeight) return;

    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return;

    canvas.width = video.videoWidth;
    canvas.height = video.videoHeight;
    if (!canvas.width || !canvas.height) return;

    ctx.drawImage(video, 0, 0, canvas.width, canvas.height);

    const now = Date.now();
    const delta = now - this.lastCheckTime;
    this.lastCheckTime = now;

    if (this.activeCapture() === 'selfie') {
      // Selfie detection
      const face = this.findFaceRegionImproved(ctx, canvas.width, canvas.height);

      if (face && face.confidence > 0.4) {
        const oval = this.getSelfieOvalBounds(canvas.width, canvas.height);

        // Verificar si el rostro está dentro del óvalo
        const isWithinOval = this.isPointWithinOval(
          face.centerX,
          face.centerY,
          oval.centerX,
          oval.centerY,
          oval.width * this.ovalScale(),
          oval.height * this.ovalScale()
        );
        
        if (isWithinOval) {
          this.faceDetected.set(true);
          
          // Guardar la detección para uso en captura
          this.lastFaceDetection = face;
          
          // Calcular posición del rostro respecto al centro del canvas
          const targetX = face.centerX - canvas.width / 2;
          const targetY = face.centerY - canvas.height / 2;

          // Mantener el óvalo centrado respecto al rostro sin invertir la dirección.
          this.ovalOffsetX.update(v => v + (targetX - v) * 0.15);
          this.ovalOffsetY.update(v => v + (targetY - v) * 0.15);

          // Adaptar tamaño basado en características detectadas
          if (face.width && face.height) {
            const faceWidth = Math.max(face.width, face.height);
            const screenWidth = Math.min(canvas.width * 0.6, 300);
            const targetScale = (faceWidth / screenWidth) * 1.2;
            this.ovalScale.update(v => v + (targetScale - v) * 0.1);
            this.ovalScale.set(Math.max(0.8, Math.min(1.8, this.ovalScale())));
          }

          // Evaluar calidad del rostro
          const qualityScore = (face.eyesDetected ? 25 : 0) +
                              (face.mouthDetected ? 25 : 0) +
                              (face.confidence * 50);
          
          this.faceQualityGood.set(qualityScore > 50);

          this.processLivenessSteps(delta, face);
        } else {
          // Rostro detectado pero fuera del óvalo
          this.faceDetected.set(false);
          this.faceQualityGood.set(false);
          this.faceStableTime = 0;
          this.stableQualityTime = 0;
          this.livenessInstruction.set('⬆️ Coloca tu rostro DENTRO del óvalo');
        }
      } else {
        this.faceDetected.set(false);
        this.faceQualityGood.set(false);
        this.faceStableTime = 0;
        this.stableQualityTime = 0;
        if (this.livenessStep() !== 'COMPLETE') {
          this.livenessInstruction.set('No se detecta tu rostro. Asegúrate de tener buena luz.');
        }
      }
    } else {
      // Document detection
      this.performDocumentDetection(ctx, canvas.width, canvas.height);
    }
  }

  /**
   * Verifica si un punto está dentro de una elipse
   */
  private isPointWithinOval(
    pointX: number,
    pointY: number,
    ovalCenterX: number,
    ovalCenterY: number,
    ovalWidth: number,
    ovalHeight: number
  ): boolean {
    // Calcular posición relativa del punto respecto al centro del óvalo
    const relX = pointX - ovalCenterX;
    const relY = pointY - ovalCenterY;
    
    // Semi-ejes del óvalo
    const a = ovalWidth / 2;
    const b = ovalHeight / 2;
    
    // Fórmula de elipse: (x/a)² + (y/b)² <= 1
    const ellipseValue = (relX * relX) / (a * a) + (relY * relY) / (b * b);
    
    // Agregar pequeño margen para ser más tolerante (0.95 en lugar de 1)
    return ellipseValue <= 0.95;
  }

  private performDocumentDetection(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (!width || !height) return;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Detectar bordes del documento
    let minX = width, maxX = 0, minY = height, maxY = 0;
    let edgePixels = 0;
    
    // Buscar bordes oscuros (que típicamente son los límites de la cédula)
    for (let y = Math.floor(height * 0.2); y < Math.floor(height * 0.8); y += 10) {
      for (let x = Math.floor(width * 0.1); x < Math.floor(width * 0.9); x += 10) {
        const index = (y * width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Detectar píxeles oscuros (bordes del documento)
        if (r < 100 && g < 100 && b < 100) {
          edgePixels++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }
    
    // Calcular brillo promedio
    let brightness = 0;
    for (let i = 0; i < data.length; i += 40) {
      brightness += (data[i] + data[i+1] + data[i+2]) / 3;
    }
    const avgBrightness = brightness / (data.length / 40);
    
    // Evaluar calidad del documento
    const hasGoodEdges = edgePixels > 100;
    const hasGoodBrightness = avgBrightness > 50 && avgBrightness < 220;
    const hasContrast = edgePixels > data.length / 2400; // Relación de píxeles oscuros
    
    // Guardar bounds del documento detectado si hay bordes
    if (hasGoodEdges && maxX > minX && maxY > minY) {
      // Calcular área con padding
      const padding = Math.min(width, height) * 0.1;
      this.lastDocumentBounds = {
        left: Math.max(0, minX - padding),
        top: Math.max(0, minY - padding),
        width: Math.min(width, maxX - minX + padding * 2),
        height: Math.min(height, maxY - minY + padding * 2)
      };
    }
    
    // Determinar alineación y calidad
    if (hasGoodEdges && hasGoodBrightness && hasContrast) {
      this.documentAligned.set(true);
      this.documentQuality.set('good');
      this.livenessInstruction.set('✓ Documento bien alineado. Toca capturar.');
    } else if (hasGoodBrightness) {
      this.documentAligned.set(false);
      this.documentQuality.set('fair');
      if (avgBrightness < 50) {
        this.livenessInstruction.set('⚠ Demasiado oscuro. Mejora la iluminación.');
      } else if (avgBrightness > 220) {
        this.livenessInstruction.set('⚠ Demasiado brillo. Evita el reflejo.');
      } else {
        this.livenessInstruction.set('Alinea mejor el documento dentro del marco');
      }
    } else {
      this.documentAligned.set(false);
      this.documentQuality.set('poor');
      this.livenessInstruction.set('❌ Iluminación insuficiente o documento no visible');
    }
  }

  private processLivenessSteps(delta: number, face: any) {
    const currentStep = this.livenessStep();

    if (currentStep === 'CENTER') {
      if (this.faceQualityGood()) {
        // Contar tiempo con buena calidad
        this.stableQualityTime += delta;
        const remainingGood = Math.ceil((this.requiredStableTimeGood - this.stableQualityTime) / 1000);
        
        if (remainingGood > 0) {
          this.livenessInstruction.set(`✓ Rostro válido detectado. Mantente quieto... ${remainingGood}s`);
        }
      } else {
        // Resetear si no está de buena calidad
        this.stableQualityTime = 0;
        this.livenessInstruction.set('Coloca tu rostro dentro del óvalo');
      }
      
      // Auto-captura solo después de mucho más tiempo como fallback
      this.faceStableTime += delta;
      if (this.faceStableTime > this.requiredStableTime && this.faceQualityGood()) {
        this.livenessStep.set('COMPLETE');
        this.livenessInstruction.set('¡Perfecto! Capturando...');
        setTimeout(() => this.capturePhoto(), 500);
      }
    }
  }

  private findFaceRegionImproved(ctx: CanvasRenderingContext2D, width: number, height: number) {
    if (!width || !height) return null;

    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    
    // Escanear por píxeles para detectar características
    let skinPixels: Array<{x: number, y: number}> = [];
    let darkPixels: Array<{x: number, y: number}> = [];
    
    const step = 15;
    for (let y = height * 0.15; y < height * 0.85; y += step) {
      for (let x = width * 0.15; x < width * 0.85; x += step) {
        const index = (Math.floor(y) * width + Math.floor(x)) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];
        
        // Detección mejorada de tono de piel
        if (this.isSkinTone(r, g, b)) {
          skinPixels.push({x, y});
        }
        
        // Detectar píxeles oscuros (ojos, sombras)
        if (this.isDarkPixel(r, g, b)) {
          darkPixels.push({x, y});
        }
      }
    }
    
    if (skinPixels.length < 15) return null;
    
    // Calcular bounding box del rostro
    let minX = width, maxX = 0, minY = height, maxY = 0;
    for (const pixel of skinPixels) {
      minX = Math.min(minX, pixel.x);
      maxX = Math.max(maxX, pixel.x);
      minY = Math.min(minY, pixel.y);
      maxY = Math.max(maxY, pixel.y);
    }
    
    const faceWidth = maxX - minX;
    const faceHeight = maxY - minY;
    const faceArea = faceWidth * faceHeight;
    
    // Verificar que el rostro ocupe un tamaño razonable
    const screenArea = width * height;
    if (faceArea < screenArea * 0.03 || faceArea > screenArea * 0.5) {
      return null;
    }
    
    // Centro del rostro
    const centerX = (minX + maxX) / 2;
    const centerY = (minY + maxY) / 2;
    
    // Detectar características (ojos)
    const eyesDetected = darkPixels.length > skinPixels.length * 0.15;
    
    // Detección simple de boca (píxeles de color diferente en la parte inferior)
    let mouthDetected = false;
    const mouthRegionY = minY + faceHeight * 0.65;
    const mouthCount = darkPixels.filter(p => p.y > mouthRegionY).length;
    mouthDetected = mouthCount > darkPixels.length * 0.1;
    
    const confidence = (skinPixels.length / 100) * (eyesDetected ? 1.3 : 0.8);
    
    return {
      centerX,
      centerY,
      width: faceWidth,
      height: faceHeight,
      area: faceArea,
      confidence: Math.min(1, confidence),
      eyesDetected,
      mouthDetected
    };
  }
  
  private isSkinTone(r: number, g: number, b: number): boolean {
    // Mejorado: detección más precisa de tonos de piel
    return r > 95 && g > 40 && b > 20 && 
           r > g && r > b && 
           Math.abs(r - g) > 15 &&
           (r - b) > 15;
  }
  
  private isDarkPixel(r: number, g: number, b: number): boolean {
    // Detectar píxeles oscuros (para ojos)
    const brightness = (r + g + b) / 3;
    return brightness < 100;
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

      let croppedCanvas = canvas;

      if (this.activeCapture() === 'selfie') {
        this.rawSelfieDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        this.selfieFallbackTried = false;
        croppedCanvas = this.cropToSelfieOvalRegion(canvas);
      } else if (this.activeCapture() === 'documentFront' || this.activeCapture() === 'documentBack') {
        const documentCanvas = this.cropToDocumentGuideRegion(canvas);
        croppedCanvas = documentCanvas || canvas;

        const preferredFace = this.pickLargestLeftFaceForDocument(canvas);
        if (preferredFace) {
          console.log('[DOC][front] Rostro preferido para la cédula:', {
            area: preferredFace.area,
            centerX: preferredFace.centerX,
            centerY: preferredFace.centerY,
            left: preferredFace.minX,
            width: preferredFace.width,
            height: preferredFace.height,
          });
        } else {
          console.warn('[DOC][front] No se detectó un rostro válido en la cédula frontal.');
        }

        console.log('[OCR][capture] Captura documental recortada al marco guía', {
          source: { width: canvas.width, height: canvas.height },
          result: { width: croppedCanvas.width, height: croppedCanvas.height }
        });
      }

      // Verificación básica de calidad para documentos
      if (this.activeCapture() === 'documentFront' || this.activeCapture() === 'documentBack') {
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

      croppedCanvas.toBlob((blob) => {
        if (blob) {
          const file = new File([blob], `${this.activeCapture()}_${Date.now()}.jpg`, { type: 'image/jpeg' });
          if (this.activeCapture() === 'selfie') {
            this.selfieFile = file;
            this.state.selfieUrl = URL.createObjectURL(file);
            this.uploadSelfie();
          } else if (this.activeCapture() === 'documentFront') {
            this.docFrontFile = file;
            this.state.idDocumentFrontUrl = URL.createObjectURL(file);
            this.uploadIdDocument('front');
          } else {
            this.docBackFile = file;
            this.state.idDocumentBackUrl = URL.createObjectURL(file);
            this.uploadIdDocument('back');
          }
          this.stopCamera();
        }
      }, 'image/jpeg', 0.9);
    }
  }

  /**
   * Recorta el documento al marco guía mostrado en pantalla.
   * Mantiene proporción de cédula (1.6:1) y centra el recorte para evitar fondo extra.
   */
  private cropToDocumentGuideRegion(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const video = this.videoElement?.nativeElement as HTMLVideoElement | undefined;
    const guide = this.documentGuide?.nativeElement as HTMLDivElement | undefined;

    if (video && guide) {
      const guideRect = guide.getBoundingClientRect();
      const videoRect = video.getBoundingClientRect();

      const rect = calculateDocumentCaptureRect({
        canvasWidth: canvas.width,
        canvasHeight: canvas.height,
        videoWidth: video.videoWidth,
        videoHeight: video.videoHeight,
        videoRect: {
          left: videoRect.left,
          top: videoRect.top,
          width: videoRect.width,
          height: videoRect.height,
        },
        guideRect: {
          left: guideRect.left,
          top: guideRect.top,
          width: guideRect.width,
          height: guideRect.height,
        },
        marginRatio: 0.02,
        documentAspect: 1.58,
      });

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(1, rect.width);
      cropCanvas.height = Math.max(1, rect.height);

      const ctx = cropCanvas.getContext('2d');
      if (ctx) {
        ctx.fillStyle = '#000000';
        ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
        ctx.drawImage(
          canvas,
          rect.left,
          rect.top,
          rect.width,
          rect.height,
          0,
          0,
          cropCanvas.width,
          cropCanvas.height
        );
      }

      console.log('[OCR][capture] Documento recortado usando guía visible', {
        guideRect: { left: guideRect.left, top: guideRect.top, width: guideRect.width, height: guideRect.height },
        source: rect,
        video: { width: video.videoWidth, height: video.videoHeight },
      });

      return cropCanvas;
    }

    const detected = this.findDocumentBoundsByEdges(canvas);
    const targetAspect = 1.55;

    const cropRect = detected && detected.width > 150 && detected.height > 120
      ? detected
      : {
          left: Math.max(0, Math.floor((canvas.width - canvas.width * 0.72) / 2)),
          top: Math.max(0, Math.floor((canvas.height - (canvas.width * 0.72) / targetAspect) / 2)),
          width: Math.max(260, Math.floor(canvas.width * 0.72)),
          height: Math.max(260, Math.floor((canvas.width * 0.72) / targetAspect))
        };

    const finalWidth = Math.min(cropRect.width, canvas.width - cropRect.left);
    const finalHeight = Math.min(cropRect.height, canvas.height - cropRect.top);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.max(1, finalWidth);
    cropCanvas.height = Math.max(1, finalHeight);

    const ctx = cropCanvas.getContext('2d');
    if (ctx) {
      ctx.fillStyle = '#000000';
      ctx.fillRect(0, 0, cropCanvas.width, cropCanvas.height);
      ctx.drawImage(
        canvas,
        cropRect.left,
        cropRect.top,
        finalWidth,
        finalHeight,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );
    }

    return cropCanvas;
  }

  private findDocumentBoundsByEdges(canvas: HTMLCanvasElement): { left: number; top: number; width: number; height: number } | null {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    const data = imageData.data;
    let minX = canvas.width;
    let minY = canvas.height;
    let maxX = 0;
    let maxY = 0;
    let darkPixels = 0;

    for (let y = 0; y < canvas.height; y += 6) {
      for (let x = 0; x < canvas.width; x += 6) {
        const index = (y * canvas.width + x) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        const brightness = (r + g + b) / 3;

        if (brightness < 170 || (r > 160 && g > 160 && b > 160 && (r - g) < 25 && (g - b) < 25)) {
          darkPixels++;
          minX = Math.min(minX, x);
          maxX = Math.max(maxX, x);
          minY = Math.min(minY, y);
          maxY = Math.max(maxY, y);
        }
      }
    }

    if (darkPixels < 200 || maxX <= minX || maxY <= minY) {
      return null;
    }

    const padding = 30;
    const left = Math.max(0, minX - padding);
    const top = Math.max(0, minY - padding);
    const width = Math.min(canvas.width - left, maxX - minX + padding * 2);
    const height = Math.min(canvas.height - top, maxY - minY + padding * 2);

    return {
      left,
      top,
      width: Math.max(180, width),
      height: Math.max(180, height)
    };
  }

  private pickLargestLeftFaceForDocument(canvas: HTMLCanvasElement): any | null {
    const ctx = canvas.getContext('2d', { willReadFrequently: true });
    if (!ctx) return null;

    const width = canvas.width;
    const height = canvas.height;
    const imageData = ctx.getImageData(0, 0, width, height);
    const data = imageData.data;
    const skinPixels: Array<{ x: number; y: number }> = [];
    const step = 18;

    for (let y = height * 0.1; y < height * 0.9; y += step) {
      for (let x = width * 0.1; x < width * 0.9; x += step) {
        const index = (Math.floor(y) * width + Math.floor(x)) * 4;
        const r = data[index];
        const g = data[index + 1];
        const b = data[index + 2];

        if (this.isSkinTone(r, g, b)) {
          skinPixels.push({ x, y });
        }
      }
    }

    if (skinPixels.length < 10) return null;

    const clusters: Array<{ minX: number; maxX: number; minY: number; maxY: number; pixels: Array<{ x: number; y: number }> }> = [];

    for (const pixel of skinPixels) {
      let assigned = false;
      for (const cluster of clusters) {
        const nearX = Math.abs(pixel.x - ((cluster.minX + cluster.maxX) / 2)) < 40;
        const nearY = Math.abs(pixel.y - ((cluster.minY + cluster.maxY) / 2)) < 40;
        if (nearX && nearY) {
          cluster.pixels.push(pixel);
          cluster.minX = Math.min(cluster.minX, pixel.x);
          cluster.maxX = Math.max(cluster.maxX, pixel.x);
          cluster.minY = Math.min(cluster.minY, pixel.y);
          cluster.maxY = Math.max(cluster.maxY, pixel.y);
          assigned = true;
          break;
        }
      }
      if (!assigned) {
        clusters.push({ minX: pixel.x, maxX: pixel.x, minY: pixel.y, maxY: pixel.y, pixels: [pixel] });
      }
    }

    const faces = clusters
      .map(cluster => {
        const faceWidth = cluster.maxX - cluster.minX;
        const faceHeight = cluster.maxY - cluster.minY;
        const area = faceWidth * faceHeight;
        return {
          area,
          centerX: (cluster.minX + cluster.maxX) / 2,
          centerY: (cluster.minY + cluster.maxY) / 2,
          width: faceWidth,
          height: faceHeight,
          minX: cluster.minX,
          maxX: cluster.maxX,
        };
      })
      .filter(face => face.area > (width * height) * 0.02 && face.area < (width * height) * 0.4);

    if (faces.length === 0) return null;

    faces.sort((a, b) => {
      if (b.area !== a.area) return b.area - a.area;
      return a.minX - b.minX;
    });

    return faces[0];
  }

  /**
   * Hace crop basado en el óvalo de selfie mostrado en pantalla.
   */
  private cropToSelfieOvalRegion(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const scale = this.ovalScale();
    const oval = this.getSelfieOvalBounds(canvas.width, canvas.height);
    const ovalWidth = oval.width * scale;
    const ovalHeight = oval.height * scale;
    const horizontalPadding = ovalWidth * 0.18;
    const topPadding = ovalHeight * 0.24;
    const bottomPadding = ovalHeight * 0.30;

    const centerX = oval.centerX;
    const centerY = oval.centerY;

    const left = Math.max(0, centerX - ovalWidth / 2 - horizontalPadding);
    const top = Math.max(0, centerY - ovalHeight / 2 - topPadding);
    const width = Math.min(canvas.width - left, ovalWidth + horizontalPadding * 2);
    const height = Math.min(canvas.height - top, ovalHeight + topPadding + bottomPadding);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.max(1, Math.floor(width));
    cropCanvas.height = Math.max(1, Math.floor(height));

    const ctx = cropCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        canvas,
        left,
        top,
        width,
        height,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );
    }

    return cropCanvas;
  }

  /**
   * Hace crop de la región del rostro desde el canvas
   */
  private cropToFaceRegion(canvas: HTMLCanvasElement, face: any): HTMLCanvasElement {
    // Padding alrededor del rostro
    const padding = Math.max(face.width, face.height) * 0.3; // 30% de padding
    
    // Calcular región a capturar
    const left = Math.max(0, face.centerX - face.width / 2 - padding);
    const top = Math.max(0, face.centerY - face.height / 2 - padding);
    const width = Math.min(canvas.width - left, face.width + padding * 2);
    const height = Math.min(canvas.height - top, face.height + padding * 2);
    
    // Crear canvas de crop
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = width;
    cropCanvas.height = height;
    
    const ctx = cropCanvas.getContext('2d');
    if (ctx) {
      // Obtener solo la región del rostro
      const imageData = canvas
        .getContext('2d')!
        .getImageData(left, top, width, height);
      ctx.putImageData(imageData, 0, 0);
    }
    
    return cropCanvas;
  }

  /**
   * Hace crop de la región del documento desde el canvas
   */
  private cropToDocumentRegion(canvas: HTMLCanvasElement, bounds: any): HTMLCanvasElement {
    const { left, top, width, height } = bounds;
    
    // Crear canvas de crop
    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = width;
    cropCanvas.height = height;
    
    const ctx = cropCanvas.getContext('2d');
    if (ctx) {
      // Obtener solo la región del documento
      const imageData = canvas
        .getContext('2d')!
        .getImageData(left, top, width, height);
      ctx.putImageData(imageData, 0, 0);
    }
    
    return cropCanvas;
  }

  onDocumentSelect(event: Event): void {
    const file = (event.target as HTMLInputElement).files?.[0];
    if (!file) return;
    this.docFrontFile = file;
    const reader = new FileReader();
    reader.onload = (e) => this.state.idDocumentFrontUrl = e.target?.result as string;
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

      // Caso clave: backend exige rol PROVIDER para subir documentos.
      if (this.isProviderPermissionError(err)) {
        const userRole = this.storage.user()?.role;

        if (userRole !== 'PROVIDER') {
          this.error.set('Tu sesión actual no tiene rol de proveedor. Cierra sesión e ingresa como proveedor para continuar.');
          return;
        }

        const refreshed = await this.retryUploadAfterRefresh(this.selfieFile, 'SELFIE');
        if (refreshed?.id) {
          this.state.selfieDocumentId = refreshed.id;
          console.log('✅ Selfie subida tras refresh de token:', refreshed.id);
          return;
        }
      }

      // Fallback de una sola vez: intentar con el frame completo sin crop.
      if (!this.selfieFallbackTried && this.rawSelfieDataUrl) {
        try {
          this.selfieFallbackTried = true;
          this.selfieFile = await this.dataUrlToFile(this.rawSelfieDataUrl, `selfie_full_${Date.now()}.jpg`);

          const retryResult = await firstValueFrom(
            this.uploadService.uploadDocument(this.selfieFile, 'SELFIE')
          );

          this.state.selfieDocumentId = retryResult.id;
          console.log('✅ Selfie subida con fallback (frame completo):', retryResult.id);
          return;
        } catch (retryErr: any) {
          console.error('Selfie fallback upload failed:', retryErr);
          this.error.set(this.extractBackendErrorMessage(retryErr, 'No pudimos identificar un rostro válido en la selfie.'));
          return;
        }
      }

      this.error.set(this.extractBackendErrorMessage(err, 'No pudimos identificar un rostro válido en la selfie.'));
    } finally {
      this.state.uploading = false;
    }
  }

  private extractBackendErrorMessage(err: any, fallback: string): string {
    const status = err?.status ? `HTTP ${err.status}` : 'HTTP n/a';
    const payload = err?.error;

    const details: string[] = [];
    if (typeof payload === 'string') {
      details.push(payload);
    } else if (payload) {
      if (payload.message) details.push(payload.message);
      if (payload.error) details.push(payload.error);
      if (payload.detail) {
        if (Array.isArray(payload.detail)) {
          details.push(payload.detail.map((d: any) => d?.msg || JSON.stringify(d)).join(' | '));
        } else {
          details.push(typeof payload.detail === 'string' ? payload.detail : JSON.stringify(payload.detail));
        }
      }
      if (payload.code) details.push(`code=${payload.code}`);
    }

    const detailsText = details.filter(Boolean).join(' | ');
    console.error('[SELFIE][BACKEND]', { status, payload, detailsText });

    return detailsText
      ? `${fallback} ${status}. Detalle backend: ${detailsText}`
      : `${fallback} ${status}.`;
  }

  private async dataUrlToFile(dataUrl: string, fileName: string): Promise<File> {
    const response = await fetch(dataUrl);
    const blob = await response.blob();
    return new File([blob], fileName, { type: 'image/jpeg' });
  }

  /**
   * Upload ID document with validation
   */
  async uploadIdDocument(side: 'front' | 'back'): Promise<void> {
    const file = side === 'front' ? this.docFrontFile : this.docBackFile;

    if (!file) {
      this.error.set(side === 'front'
        ? 'Primero captura el frente de tu cédula.'
        : 'Primero valida la selfie y el frente de la cédula para tomar el reverso.');
      return;
    }

    if (side === 'back' && !this.canCaptureBackDocument()) {
      this.error.set('El reverso solo puede tomarse después de validar la selfie y el frente.');
      return;
    }

    try {
      this.state.uploading = true;
      this.error.set('');

      const result = await firstValueFrom(
        this.uploadService.uploadDocument(file, 'IDENTITY_DOCUMENT')
      );

      if (side === 'front') {
        this.state.idDocumentFrontId = result.id;
        this.state.frontRunDigits = await this.uploadService.extractRunFromFrontImage(file);
        console.log('[OCR][front] RUN guardado desde el frente:', this.state.frontRunDigits);
      } else {
        this.state.idDocumentBackId = result.id;
      }
      console.log(`✅ Documento ${side === 'front' ? 'frontal' : 'posterior'} subido con éxito:`, result.id);

      // Se evita la vista intermedia de preview facial. La validación comienza cuando ya están las 3 imágenes.
    } catch (err: any) {
      console.error('ID document upload failed:', err);

      if (this.isProviderPermissionError(err)) {
        const userRole = this.storage.user()?.role;

        if (userRole !== 'PROVIDER') {
          this.error.set('Tu sesión actual no tiene rol de proveedor. Cierra sesión e ingresa como proveedor para continuar.');
          return;
        }

        const refreshed = await this.retryUploadAfterRefresh(file, 'IDENTITY_DOCUMENT');
        if (refreshed?.id) {
          if (side === 'front') {
            this.state.idDocumentFrontId = refreshed.id;
          } else {
            this.state.idDocumentBackId = refreshed.id;
          }
          console.log(`✅ Documento ${side === 'front' ? 'frontal' : 'posterior'} subido tras refresh de token:`, refreshed.id);
          return;
        }
      }

      this.error.set(this.extractBackendErrorMessage(err, 'No se reconoció el documento de identidad.'));
    } finally {
      this.state.uploading = false;
    }
  }

  private isProviderPermissionError(err: any): boolean {
    const status = err?.status;
    const msg = (err?.error?.detail || err?.error?.message || err?.error || '').toString().toLowerCase();
    return status === 403 && msg.includes('only providers can upload documents');
  }

  private async retryUploadAfterRefresh(
    file: File | null,
    documentType: 'SELFIE' | 'IDENTITY_DOCUMENT'
  ): Promise<any | null> {
    if (!file) return null;

    try {
      await firstValueFrom(this.auth.refreshToken());
      return await firstValueFrom(this.uploadService.uploadDocument(file, documentType));
    } catch (refreshErr) {
      console.error(`[${documentType}] Upload failed after token refresh:`, refreshErr);
      return null;
    }
  }

  /**
   * Load face preview (FIX ERROR 431: Convert base64 to Data URL)
   */
  async loadFacePreview(): Promise<void> {
    if (!this.state.selfieDocumentId || !this.state.idDocumentFrontId) {
      this.error.set('Debes subir la selfie y el frente de la cédula antes de continuar.');
      return;
    }

    try {
      this.state.loadingPreview = true;
      this.state.facePreviewError = null;
      this.state.faceDetectionFailed = false;

      const result = await firstValueFrom(
        this.uploadService.getFacePreview(
          this.state.selfieDocumentId,
          this.state.idDocumentFrontId
        )
      );

      if (result) {
        // FIX ERROR 431: Add Data URL prefix to base64 strings
        this.state.selfieFacePreview = result.selfie_preview 
          ? `data:image/jpeg;base64,${result.selfie_preview}` 
          : result.selfie_preview_url || null;
        this.state.idFrontFacePreview = result.id_preview 
          ? `data:image/jpeg;base64,${result.id_preview}` 
          : result.id_preview_url || null;

        const hasPreviewData = !!(this.state.selfieFacePreview && this.state.idFrontFacePreview);
        const selfieDetected = result.selfie_detected === true || !!result.selfie_preview || !!result.selfie_preview_url;
        const idDetected = result.id_detected === true || !!result.id_preview || !!result.id_preview_url;
        const successFlag = typeof result.success === 'boolean' ? result.success : true;
        const facesDetected = (successFlag || selfieDetected || idDetected) && (hasPreviewData || selfieDetected || idDetected);

        if (facesDetected || hasPreviewData) {
          console.log('✅ Face preview loaded successfully', {
            successFlag,
            selfieDetected,
            idDetected,
            hasPreviewData,
            previewKeys: Object.keys(result || {}),
          });
        } else {
          const errorMsg = result.error || '';
          if (!this.isAwsError(errorMsg)) {
            this.state.facePreviewError = this.mapFacePreviewError(errorMsg, result);
            this.state.faceDetectionFailed = true;
            this.error.set(this.state.facePreviewError);
          }
          console.warn('Face preview no disponible:', errorMsg || 'sin detalle');
        }
      }
    } catch (err: any) {
      console.warn('Failed to load face preview:', err);
      const errorMessage = err?.error?.detail || err?.message || 'Error';
      if (!this.isAwsError(errorMessage)) {
        this.state.facePreviewError = this.mapFacePreviewError(errorMessage, null);
        this.state.faceDetectionFailed = true;
        this.error.set(this.state.facePreviewError);
      }
    } finally {
      this.state.loadingPreview = false;
    }
  }

  private isAwsError(msg: string): boolean {
    return [
      'AWS_ACCESS_KEY_ID',
      'UnrecognizedClientException',
      'security token',
      'InvalidClientTokenId',
      'ExpiredTokenException',
    ].some(token => msg.includes(token));
  }

  private mapFacePreviewError(msg: string, result: any): string {
    const lower = msg.toLowerCase();
    const noSelfie = !(result?.selfie_preview || result?.selfie_preview_url || result?.selfie_detected);
    const noDoc = !(result?.id_preview || result?.id_preview_url || result?.id_detected);

    if (noSelfie && noDoc) {
      return 'No se detectó un rostro ni en la selfie ni en el documento. Vuelve a capturarlos con buena iluminación.';
    }
    if (noSelfie || (lower.includes('selfie') && (lower.includes('no face') || lower.includes('not detected')))) {
      return 'No se detectó un rostro en la selfie. Captúrala de frente, sin obstrucciones y con buena luz.';
    }
    if (noDoc || ((lower.includes('document') || lower.includes('id')) && (lower.includes('no face') || lower.includes('not detected')))) {
      return 'No se detectó un rostro en el documento. Asegúrate de fotografiar tu cédula de identidad chilena mostrando claramente la foto.';
    }
    if (lower.includes('multiple') || lower.includes('more than one')) {
      return 'Se detectaron múltiples rostros. La selfie debe mostrar solo tu rostro.';
    }
    if (lower.includes('blurry') || lower.includes('blur') || lower.includes('quality')) {
      return 'La imagen está borrosa o con baja calidad. Repite la captura con mejor iluminación.';
    }
    if (msg) {
      return `No se pudieron detectar rostros correctamente: ${msg}`;
    }
    return 'No se pudieron detectar rostros en las imágenes. Verifica que ambos rostros se vean claramente.';
  }

  private async validateProviderRunMatchesDocument(): Promise<boolean> {
    try {
      const providerProfile = await firstValueFrom(this.http.get<any>(`${this.api}/providers/me`));
      const registeredRun = providerProfile?.run;

      if (!registeredRun) {
        this.error.set('No se encontró el RUN registrado del proveedor para validar la cédula.');
        return false;
      }

      const documentRun = this.state.frontRunDigits ?? (
        this.docFrontFile ? await this.uploadService.extractRunFromFrontImage(this.docFrontFile) : null
      );

      if (!documentRun) {
        this.error.set('No se pudo leer el RUN de la cédula para comparar con el registro del proveedor.');
        return false;
      }

      const registeredDigits = normalizeRunToDigits(normalizeChileanRUTForBackend(registeredRun));
      const documentDigits = normalizeRunToDigits(documentRun);

      if (registeredDigits !== documentDigits) {
        const formattedRegisteredRun = normalizeChileanRUTForBackend(registeredRun);
        this.state.idCardValidationError = `El RUN de la cédula (${documentDigits || 'N/A'}) no coincide con el RUN registrado del proveedor (${formattedRegisteredRun || 'N/A'}).`;
        this.error.set(this.state.idCardValidationError);
        return false;
      }

      return true;
    } catch (err) {
      console.error('Error validando RUN del proveedor vs cédula:', err);
      this.error.set('No se pudo validar que el RUN de la cédula coincida con el registro del proveedor.');
      return false;
    }
  }

  private mapRejectionReason(result: any): string {
    const reason = (result?.rejection_reason || result?.error || result?.detail || '').toLowerCase();
    const score = result?.face_match_score ? parseFloat(result.face_match_score) : null;

    if (reason.includes('no face') && reason.includes('selfie')) {
      return 'No se detectó un rostro en tu selfie.';
    }
    if (reason.includes('no face') && (reason.includes('document') || reason.includes('id'))) {
      return 'No se detectó un rostro en el documento. Asegúrate de usar una cédula de identidad chilena.';
    }
    if (reason.includes('match') || reason.includes('differ') || reason.includes('not the same')) {
      const scoreText = score !== null ? ` (similitud: ${score.toFixed(1)}%)` : '';
      return `La selfie y el documento no corresponden a la misma persona${scoreText}.`;
    }
    if (reason.includes('quality') || reason.includes('blurry') || reason.includes('blur')) {
      return 'La calidad de las imágenes no es suficiente. Intenta con mejor iluminación y enfoque.';
    }
    if (score !== null && score < 50) {
      return `Los rostros no coinciden (similitud: ${score.toFixed(1)}%).`;
    }
    if (result?.face_match_status === 'REJECTED') {
      return 'La verificación fue rechazada. Sube una selfie clara y una cédula de identidad chilena vigente.';
    }
    return 'La verificación no pudo completarse. Revisa las imágenes y vuelve a intentarlo.';
  }

  private validateRequiredPhoto(file: File | null, label: string): string | null {
    if (!file) {
      return `${label} no está tomada.`;
    }

    if (!(file instanceof File)) {
      return `${label} no es un archivo válido.`;
    }

    if (file.size <= 0) {
      return `${label} está vacía.`;
    }

    if (!file.type.startsWith('image/')) {
      return `${label} no es una imagen válida.`;
    }

    return null;
  }

  canStartValidation(): boolean {
    return !!this.selfieFile && !!this.docFrontFile && !!this.docBackFile && !this.loading();
  }

  private getMissingPhotoError(): string | null {
    const selfieError = this.validateRequiredPhoto(this.selfieFile, 'La selfie');
    if (selfieError) return selfieError;

    const frontError = this.validateRequiredPhoto(this.docFrontFile, 'La foto del frente de la cédula');
    if (frontError) return frontError;

    const backError = this.validateRequiredPhoto(this.docBackFile, 'La foto del reverso de la cédula');
    if (backError) return backError;

    return null;
  }

  /**
   * Submit documents for upload and preview
   */
  async submit(): Promise<void> {
    const frontFile = this.docFrontFile;
    const backFile = this.docBackFile;
    const selfieFile = this.selfieFile;

    const missingRequiredPhotoError = this.getMissingPhotoError();
    if (missingRequiredPhotoError || !frontFile || !backFile || !selfieFile) {
      this.error.set(`Antes de continuar debes tomar las 3 fotos: ${missingRequiredPhotoError || 'falta una imagen requerida.'}`);
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.step.set('verifying');

    console.log('[OCR][verification] Iniciando validación de cédula desde submit()', {
      hasSelfie: !!selfieFile,
      hasFront: !!frontFile,
      hasBack: !!backFile,
      frontName: frontFile?.name,
      backName: backFile?.name,
    });

    // Validar OCR de cédula chilena y coincidencia RUN frente/reverso antes de subir
    const idValidation = await this.uploadService.validateChileanIdPair(
      frontFile,
      backFile
    );

    console.log('[OCR][verification] Resultado validación cédula:', idValidation);
    if (!idValidation.valid) {
      this.loading.set(false);
      this.state.idCardValidated = false;
      this.state.idCardValidationError = idValidation.error || 'La cédula no pasó la validación OCR.';
      this.error.set(this.state.idCardValidationError);
      return;
    }

    this.state.idCardValidated = true;
    this.state.idCardValidationError = null;

    // Upload both documents
    await this.uploadSelfie();
    if (this.state.selfieDocumentId) {
      await this.uploadIdDocument('front');
    }
    if (this.state.idDocumentFrontId) {
      await this.uploadIdDocument('back');
    }

    this.loading.set(false);

    // La validación continúa sin mostrar la vista intermedia de comparación facial.
    await this.initiateVerification();
  }

  /**
   * Initiate face verification
   */
  async initiateVerification(): Promise<void> {
    if (!this.state.selfieDocumentId || !this.state.idDocumentFrontId) {
      this.error.set('Debes subir la selfie y el frente de la cédula antes de verificar.');
      return;
    }

    if (!this.state.idDocumentBackId) {
      this.error.set('Primero completa el reverso de la cédula para continuar con la verificación final.');
      return;
    }

    if (!this.state.frontRunDigits) {
      this.state.frontRunDigits = await this.uploadService.extractRunFromFrontImage(this.docFrontFile!);
      if (!this.state.frontRunDigits) {
        this.error.set('No se pudo leer el RUN del frente de la cédula. Vuelve a tomar la imagen del frente.');
        return;
      }
    }

    if (!this.state.idCardValidated && this.docFrontFile && this.docBackFile) {
      const idValidation = await this.uploadService.validateChileanIdPair(this.docFrontFile, this.docBackFile);
      console.log('[OCR][verification] Revalidación antes de inicio:', idValidation);
      if (!idValidation.valid) {
        this.state.idCardValidated = false;
        this.state.idCardValidationError = idValidation.error || 'La cédula no pasó la validación OCR.';
        this.error.set(this.state.idCardValidationError);
        return;
      }

      this.state.idCardValidated = true;
      this.state.idCardValidationError = null;
    }

    const runMatchesRegistered = await this.validateProviderRunMatchesDocument();
    if (!runMatchesRegistered) {
      return;
    }

    if (!this.state.idCardValidated) {
      this.error.set('Primero valida una cédula chilena correcta (frente y reverso con RUN coincidente).');
      return;
    }

    this.loading.set(true);
    this.error.set('');
    this.step.set('verifying');

    try {
      const result = await firstValueFrom(
        this.uploadService.initiateVerification(
          this.state.selfieDocumentId,
          this.state.idDocumentFrontId
        )
      );
      
      this.state.verificationInitiated = true;
      
      if (result && result.face_match_status) {
        this.state.verificationStatus = result.face_match_status;
        
        if (result.face_match_status === 'APPROVED') {
          this.step.set('approved');
          this.state.confidenceScore = parseFloat(result.face_match_score || '0');
          this.state.rejectionReason = null;
        } else if (result.face_match_status === 'REJECTED') {
          this.step.set('rejected');
          this.state.confidenceScore = parseFloat(result.face_match_score || '0');
          this.state.rejectionReason = this.mapRejectionReason(result);
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
      this.step.set('upload');
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
            this.state.rejectionReason = null;
          } else if (status.face_match_status === 'REJECTED') {
            this.step.set('rejected');
            if (this.statusCheckTimeout) {
              clearTimeout(this.statusCheckTimeout);
            }
            this.state.rejectionReason = this.mapRejectionReason(status);
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

  closeVerification(): void {
    const currentUser = this.storage.user();

    if (window.history.length > 1) {
      window.history.back();
      return;
    }

    if (!currentUser) {
      this.router.navigate(['/auth/login'], { replaceUrl: true });
      return;
    }

    if (currentUser.role === 'CLIENT') {
      this.router.navigate(['/client/categories'], { replaceUrl: true });
      return;
    }

    if (currentUser.role === 'PROVIDER' && currentUser.status === 'ACTIVE') {
      this.router.navigate(['/provider/tabs'], { replaceUrl: true });
      return;
    }

    this.router.navigate(['/auth/login'], { replaceUrl: true });
  }

  /**
   * Retry verification (when rejected)
   */
  retryVerification(): void {
    // Reset state
    this.state = {
      selfieUrl: null,
      idDocumentFrontUrl: null,
      idDocumentBackUrl: null,
      selfieDocumentId: null,
      idDocumentFrontId: null,
      idDocumentBackId: null,
      uploading: false,
      verificationInitiated: false,
      verificationStatus: 'IDLE',
      confidenceScore: null,
      retryCount: 0,
      maxRetries: 3,
      selfieFacePreview: null,
      idFrontFacePreview: null,
      loadingPreview: false,
      facePreviewError: null,
      faceDetectionFailed: false,
      frontRunDigits: null,
      rejectionReason: null,
      idCardValidationError: null,
      idCardValidated: false,
    };
    
    this.docFrontFile = null;
    this.docBackFile = null;
    this.selfieFile = null;
    this.rawSelfieDataUrl = null;
    this.selfieFallbackTried = false;
    this.step.set('upload');
    this.error.set('');
  }

  logout(): void {
    this.auth.logout();
  }
}
