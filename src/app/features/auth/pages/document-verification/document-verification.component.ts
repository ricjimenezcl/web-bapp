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
  };

  private docFrontFile: File | null = null;
  private docBackFile: File | null = null;
  private selfieFile: File | null = null;
  private rawSelfieDataUrl: string | null = null;
  private selfieFallbackTried = false;

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

  async startCamera(type: 'selfie' | 'documentFront' | 'documentBack') {
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
    this.livenessStep.set('CENTER');
    this.livenessInstruction.set('Alinea el frente de tu documento');
    this.lastCheckTime = Date.now();
    
    this.faceDetectionInterval = setInterval(() => {
      this.performDetectionCycle();
    }, 150);
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

    const now = Date.now();
    const delta = now - this.lastCheckTime;
    this.lastCheckTime = now;

    if (this.activeCapture() === 'selfie') {
      // Selfie detection
      const face = this.findFaceRegionImproved(ctx, canvas.width, canvas.height);

      if (face && face.confidence > 0.4) {
        // Calcular posición del óvalo en canvas
        const ovalCenterX = canvas.width / 2 + this.ovalOffsetX();
        const ovalCenterY = canvas.height / 2 + this.ovalOffsetY();
        
        // Verificar si el rostro está dentro del óvalo
        const isWithinOval = this.isPointWithinOval(
          face.centerX,
          face.centerY,
          ovalCenterX,
          ovalCenterY,
          256 * this.ovalScale(), // ancho del óvalo (w-64)
          384 * this.ovalScale()  // alto del óvalo (h-96)
        );
        
        if (isWithinOval) {
          this.faceDetected.set(true);
          
          // Guardar la detección para uso en captura
          this.lastFaceDetection = face;
          
          // Calcular posición del rostro respecto al centro del canvas
          const targetX = face.centerX - canvas.width / 2;
          const targetY = face.centerY - canvas.height / 2;
          
          // CORRECCIÓN: Negar los valores para mover el óvalo HACIA el rostro
          this.ovalOffsetX.update(v => v + (-targetX - v) * 0.15);
          this.ovalOffsetY.update(v => v + (-targetY - v) * 0.15);

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

      // Crop según el tipo de captura
      let croppedCanvas = canvas;
      
      if (this.activeCapture() === 'selfie') {
        // Guardar frame completo para reintento si el backend rechaza el crop.
        this.rawSelfieDataUrl = canvas.toDataURL('image/jpeg', 0.92);
        this.selfieFallbackTried = false;

        // Para selfies: usar el área del óvalo para evitar recortes demasiado agresivos.
        croppedCanvas = this.cropToSelfieOvalRegion(canvas);
      } else if (this.activeCapture() === 'documentFront' || this.activeCapture() === 'documentBack') {
        // Para documentos: recortar estrictamente al marco guía de la cédula.
        croppedCanvas = this.cropToDocumentGuideRegion(canvas);
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
    const targetAspect = 1.6;
    const cropWidth = Math.floor(canvas.width * 0.84);
    const cropHeight = Math.floor(cropWidth / targetAspect);

    const left = Math.max(0, Math.floor((canvas.width - cropWidth) / 2));
    const top = Math.max(0, Math.floor((canvas.height - cropHeight) / 2));

    const safeWidth = Math.min(cropWidth, canvas.width - left);
    const safeHeight = Math.min(cropHeight, canvas.height - top);

    const cropCanvas = document.createElement('canvas');
    cropCanvas.width = Math.max(1, safeWidth);
    cropCanvas.height = Math.max(1, safeHeight);

    const ctx = cropCanvas.getContext('2d');
    if (ctx) {
      ctx.drawImage(
        canvas,
        left,
        top,
        safeWidth,
        safeHeight,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );
    }

    return cropCanvas;
  }

  /**
   * Hace crop basado en el óvalo de selfie mostrado en pantalla.
   */
  private cropToSelfieOvalRegion(canvas: HTMLCanvasElement): HTMLCanvasElement {
    const scale = this.ovalScale();
    const ovalWidth = 256 * scale;
    const ovalHeight = 384 * scale;
    const horizontalPadding = ovalWidth * 0.18;
    const topPadding = ovalHeight * 0.24;
    const bottomPadding = ovalHeight * 0.30;

    const centerX = canvas.width / 2 + this.ovalOffsetX();
    const centerY = canvas.height / 2 + this.ovalOffsetY();

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
        : 'Primero captura el reverso de tu cédula.');
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
      } else {
        this.state.idDocumentBackId = result.id;
      }
      console.log(`✅ Documento ${side === 'front' ? 'frontal' : 'posterior'} subido con éxito:`, result.id);

      // Para preview facial solo se usa selfie + frente.
      if (this.state.selfieDocumentId && this.state.idDocumentFrontId) {
        await this.loadFacePreview();
      }
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
          if (this.state.selfieDocumentId && this.state.idDocumentFrontId) {
            await this.loadFacePreview();
          }
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
      return;
    }

    try {
      this.state.loadingPreview = true;
      this.state.facePreviewError = null;

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
          : null;
        this.state.idFrontFacePreview = result.id_preview 
          ? `data:image/jpeg;base64,${result.id_preview}` 
          : null;

        const facesDetected = result.success && 
          this.state.selfieFacePreview && 
          this.state.idFrontFacePreview;
        
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
    if (!this.selfieFile || !this.docFrontFile || !this.docBackFile) {
      this.error.set('Debes capturar selfie, frente y reverso de la cédula.');
      return;
    }

    this.loading.set(true);
    this.error.set('');

    // Upload both documents
    await this.uploadSelfie();
    if (this.state.selfieDocumentId) {
      await this.uploadIdDocument('front');
    }
    if (this.state.idDocumentFrontId) {
      await this.uploadIdDocument('back');
    }

    this.loading.set(false);

    // If face preview loaded successfully, advance to preview step
    if (this.state.selfieFacePreview && this.state.idFrontFacePreview) {
      this.step.set('preview');
    }
  }

  /**
   * Initiate face verification
   */
  async initiateVerification(): Promise<void> {
    if (!this.state.selfieDocumentId || !this.state.idDocumentFrontId || !this.state.idDocumentBackId) {
      this.error.set('Debes subir selfie, frente y reverso de la cédula');
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
