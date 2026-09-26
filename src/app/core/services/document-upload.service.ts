import { Injectable, inject } from '@angular/core';
import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Observable, firstValueFrom, throwError, timer } from 'rxjs';
import { catchError, delayWhen, map, retryWhen, scan } from 'rxjs/operators';
import { environment } from '../../../environments/environment';
import { createWorker, PSM } from 'tesseract.js';

interface ImageValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface DocumentImageQualityResult {
  valid: boolean;
  score: number;
  reason?: string;
  stats?: {
    avgBrightness: number;
    darkRatio: number;
    contrast: number;
    edgeDensity: number;
    textPixels: number;
  };
}

export interface ChileanIdValidationResult {
  valid: boolean;
  error?: string;
  frontRun?: string;
  backRun?: string;
  frontText?: string;
  backText?: string;
}

export function normalizeRunToDigits(run: string): string {
  const raw = (run ?? '').toUpperCase().replace(/[^0-9K]/g, '');
  const digitsOnly = raw.replace(/\D/g, '');
  return digitsOnly.length > 8 ? digitsOnly.slice(0, 8) : digitsOnly;
}

export function findMatchingRunInBackRows(backText: string, expectedDigits?: string): string | null {
  const lines = (backText ?? '')
    .split(/\r?\n/)
    .map(line => line.trim())
    .filter(Boolean);

  const lowerRows = lines.slice(-3);
  const expected = expectedDigits ? normalizeRunToDigits(expectedDigits) : null;

  if (!expected) {
    return null;
  }

  const backTextFlat = lowerRows.join('\n');
  if (backTextFlat.includes(expected)) {
    return expected;
  }

  const patterns = [
    /(?:RUN|RUT)[^0-9K]{0,12}([0-9]{1,2}(?:[.\s]?[0-9]{3}){2}[-.]?[0-9K])/gi,
    /(?:RUN|RUT)[^0-9K]{0,12}([0-9]{7,8}[Kk]?)/gi,
    /([0-9]{1,2}(?:[.\s]?[0-9]{3}){2}[-.]?[0-9K])/g,
    /([0-9]{7,8}[Kk]?)/g,
  ];

  const candidates = new Set<string>();
  for (const pattern of patterns) {
    for (const match of backTextFlat.matchAll(pattern)) {
      const candidate = normalizeRunToDigits(match[1] ?? match[0]);
      if (candidate.length >= 7 && candidate.length <= 8) {
        candidates.add(candidate);
      }
    }
  }

  const ordered = [...candidates].sort((a, b) => {
    const diffA = a.includes(expected) || expected.includes(a) ? 0 : 1;
    const diffB = b.includes(expected) || expected.includes(b) ? 0 : 1;
    return diffA - diffB;
  });

  return ordered.find(candidate => candidate.includes(expected) || expected.includes(candidate)) ?? null;
}

export function hasRequiredFrontIdFields(frontText: string): string[] {
  const raw = (frontText ?? '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase();
  const compact = raw.replace(/[^A-Z0-9]/g, '');
  const spaced = raw.replace(/[^A-Z0-9\s]/g, ' ').replace(/\s+/g, ' ').trim();

  const hasRunPattern = /\d{1,2}[\s.]*\d{3}[\s.]*\d{3}[\s.-]*\d/.test(spaced)
    || /\d{1,2}[\s.]*\d{3}[\s.]*\d{3}[\s.-]*\d/.test(compact)
    || /(?:RUN|RON|RUT)[\s._-]*\d{1,2}[\s.]*\d{3}[\s.]*\d{3}[\s.-]*\d/i.test(spaced)
    || /(?:RUN|RON|RUT)[\s._-]*\d{1,2}[\s.]*\d{3}[\s.]*\d{3}[\s.-]*\d/i.test(compact)
    || /\d{7,8}[K]/.test(compact);

  const hasChilePhrase = /REPUBLICA\s*DE\s*CHILE|REPUBLICADECHILE|CHILE/.test(spaced) || /REPUBLICA\s*DE\s*CHILE|REPUBLICADECHILE|CHILE/.test(compact);

  const missing: string[] = [];

  if (!hasChilePhrase) missing.push('REPUBLICA DE CHILE');
  if (!hasRunPattern) missing.push('RUN');
  // 'CEDULA DE IDENTIDAD' y 'SERVICIO DE REGISTRO CIVIL' no bloquean: el encabezado se OCRea de forma
  // muy inconsistente (letra estilizada/pequeña) y suele leerse como ruido aunque la cédula sea válida.
  // REPUBLICA DE CHILE + un RUN con formato válido ya son evidencia suficiente.

  return missing;
}

export function analyzeDocumentImageQuality(
  pixelData: Uint8ClampedArray | Uint8Array,
  width: number,
  height: number
): DocumentImageQualityResult {
  if (!width || !height || !pixelData || pixelData.length < width * height * 4) {
    return { valid: false, score: 0, reason: 'La calidad de la imagen no tiene datos válidos para evaluar.' };
  }

  let brightnessSum = 0;
  let darkPixels = 0;
  let brightPixels = 0;
  let textPixels = 0;
  let contrastSum = 0;
  let sampledPixels = 0;

  for (let i = 0; i < pixelData.length; i += 16) {
    const r = pixelData[i];
    const g = pixelData[i + 1];
    const b = pixelData[i + 2];
    const brightness = (r + g + b) / 3;

    brightnessSum += brightness;
    sampledPixels++;

    if (brightness < 160) {
      darkPixels++;
    }

    if (brightness > 225) {
      brightPixels++;
    }

    const localContrast = Math.abs(r - g) + Math.abs(g - b) + Math.abs(b - r);
    contrastSum += localContrast;

    const isUniformDark = r === g && g === b && brightness < 185;
    const isTextLike = brightness < 185 && (r < 180 || g < 180 || b < 180) && (localContrast > 10 || isUniformDark);
    if (isTextLike) {
      textPixels++;
    }
  }

  const avgBrightness = brightnessSum / Math.max(1, sampledPixels);
  const darkRatio = darkPixels / Math.max(1, sampledPixels);
  const brightRatio = brightPixels / Math.max(1, sampledPixels);
  const contrast = contrastSum / Math.max(1, sampledPixels);
  const textRatio = textPixels / Math.max(1, sampledPixels);

  const brightnessScore = 1 - Math.min(1, Math.abs(avgBrightness - 170) / 140);
  const darkScore = Math.min(1, darkRatio / 0.14);
  const textScore = Math.min(1, textRatio / 0.035);
  const exposureScore = 1 - Math.min(1, brightRatio / 0.9);
  const contrastScore = Math.min(1, contrast / 80);

  const score =
    brightnessScore * 0.3 +
    darkScore * 0.25 +
    textScore * 0.25 +
    exposureScore * 0.1 +
    contrastScore * 0.1;

  const valid =
    avgBrightness >= 35 &&
    avgBrightness <= 250 &&
    darkRatio >= 0.015 &&
    brightRatio <= 0.97 &&
    textRatio >= 0.006 &&
    score >= 0.34;

  let reason: string | undefined;
  if (!valid) {
    if (avgBrightness > 245 || brightRatio > 0.95) {
      reason = 'La calidad de la imagen está demasiado clara o sobreexpuesta.';
    } else if (avgBrightness < 40) {
      reason = 'La calidad de la imagen está demasiado oscura para leer la cédula.';
    } else if (textRatio < 0.006) {
      reason = 'La calidad de la imagen no tiene contenido legible suficiente para una cédula.';
    } else {
      reason = 'La calidad de la imagen no es suficiente para validar la cédula.';
    }
  }

  return {
    valid,
    score: Number(score.toFixed(3)),
    reason,
    stats: {
      avgBrightness: Number(avgBrightness.toFixed(2)),
      darkRatio: Number(darkRatio.toFixed(4)),
      contrast: Number(contrast.toFixed(2)),
      edgeDensity: Number((darkRatio + textRatio).toFixed(4)),
      textPixels: Math.round(textPixels),
    },
  };
}

@Injectable({
  providedIn: 'root'
})
export class DocumentUploadService {
  private readonly http = inject(HttpClient);
  private readonly API_URL = `${environment.apiUrl}/documents`;

  // Image validation constraints
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly MIN_WIDTH = 200;
  private readonly MIN_HEIGHT = 200;
  private readonly MAX_WIDTH = 8000;
  private readonly MAX_HEIGHT = 8000;

  private static readonly FRONT_REQUIRED_FIELDS = [
    'REPUBLICA DE CHILE',
    'RUN',
  ];

  /**
   * Validate image before upload
   * Checks format, size, dimensions
   */
  async validateImage(file: File): Promise<ImageValidationResult> {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size ${(file.size / 1024 / 1024).toFixed(2)}MB exceeds maximum 5MB`
      };
    }

    // Check file format
    if (!this.ALLOWED_FORMATS.includes(file.type)) {
      return {
        valid: false,
        error: `Invalid format. Allowed: JPEG, PNG, WebP. Got: ${file.type}`
      };
    }

    // Check image dimensions
    try {
      const dimensions = await this.getImageDimensions(file);
      
      if (dimensions.width < 80 || dimensions.height < 80) {
        return {
          valid: false,
          error: `Image too small (${dimensions.width}x${dimensions.height}). Minimum: 200x200`
        };
      }

      if (dimensions.width > this.MAX_WIDTH || dimensions.height > this.MAX_HEIGHT) {
        return {
          valid: false,
          error: `Image too large (${dimensions.width}x${dimensions.height}). Maximum: 8000x8000`
        };
      }

      // Warn if image is small (but valid)
      const warnings: string[] = [];
      if (dimensions.width < 400 || dimensions.height < 400) {
        warnings.push('Image is small. For better face detection, use at least 400x400 pixels');
      }

      return {
        valid: true,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        valid: false,
        error: `Failed to validate image dimensions: ${error}`
      };
    }
  }

  /**
   * Get image dimensions
   */
  private getImageDimensions(file: File): Promise<{ width: number; height: number }> {
    return new Promise((resolve, reject) => {
      const reader = new FileReader();
      
      reader.onload = (event) => {
        const img = new Image();
        
        img.onload = () => {
          resolve({
            width: img.naturalWidth,
            height: img.naturalHeight
          });
        };
        
        img.onerror = () => {
          reject(new Error('Failed to load image'));
        };
        
        img.src = event.target?.result as string;
      };
      
      reader.onerror = () => {
        reject(new Error('Failed to read file'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * OCR y validación de cédula chilena (frente y reverso)
   */
  async validateChileanIdPair(frontFile: File, backFile: File): Promise<ChileanIdValidationResult> {
    try {
      console.log('[OCR][document-upload] Iniciando validación OCR de cédula', {
        frontName: frontFile?.name,
        backName: backFile?.name,
        frontSize: frontFile?.size,
        backSize: backFile?.size,
        frontType: frontFile?.type,
        backType: backFile?.type,
      });

      const frontCandidate = await this.validateDocumentCandidate(frontFile, 'front');
      if (!frontCandidate.valid) {
        return {
          valid: false,
          error: frontCandidate.reason || 'La imagen frontal no parece una cédula válida.',
        };
      }

      const backCandidate = await this.validateDocumentCandidate(backFile, 'back');
      if (!backCandidate.valid) {
        return {
          valid: false,
          error: backCandidate.reason || 'La imagen posterior no parece una cédula válida.',
        };
      }

      const [textractFrontText, textractBackText] = await Promise.all([
        this.extractFrontTextWithTextract(frontFile),
        this.extractBackTextWithTextract(backFile),
      ]);

      const frontTextRaw = textractFrontText ?? await this.extractTextFromImage(frontFile);
      const backTextRaw = textractBackText ?? await this.extractTextFromImage(backFile);

      console.log('[OCR][document-upload] OCR terminó para ambos lados');

      const frontText = this.normalizeOcrText(frontTextRaw);
      const backText = this.normalizeOcrText(backTextRaw);

      console.log('[OCR][document-upload] Raw front OCR:', frontTextRaw);
      console.log('[OCR][document-upload] Raw back OCR:', backTextRaw);
      console.log('[OCR][document-upload] Normalized front OCR:', frontText);
      console.log('[OCR][document-upload] Normalized back OCR:', backText);

      const missingFields = hasRequiredFrontIdFields(frontText);

      if (missingFields.length > 0) {
        return {
          valid: false,
          frontText,
          backText,
          error: `La imagen frontal no corresponde a una cédula chilena válida. Faltan campos: ${missingFields.join(', ')}`,
        };
      }

      const frontRunFull = this.extractRunFromFront(frontText);
      const frontRunDigits = frontRunFull ? this.getRunDigits(frontRunFull) : '';
      console.log('[OCR][document-upload] frontRunFull:', frontRunFull);
      console.log('[OCR][document-upload] frontRunDigits:', frontRunDigits);

      if (!frontRunFull) {
        return {
          valid: false,
          frontText,
          backText,
          error: 'No se pudo extraer el RUN desde el frente de la cédula.',
        };
      }

      const backRunCandidates = this.extractRunCandidates(backText);
      console.log('[OCR][document-upload] backRunCandidates:', backRunCandidates);

      const backRunFromLowerRows = findMatchingRunInBackRows(backText, frontRunDigits);
      const backRun = backRunFromLowerRows ?? this.findMatchingRunInText(backText, frontRunDigits);
      this.logBackRunMatch(backText, frontRunDigits, backRun);
      console.log('[OCR][document-upload] backRun selected:', {
        originalRun: frontRunFull,
        formattedRun: frontRunDigits,
        matchedRun: backRun,
        backRunFromLowerRows,
      });

      if (!backRun) {
        return {
          valid: false,
          frontText,
          backText,
          frontRun: frontRunFull,
          error: 'No se pudo encontrar el RUN del frente en el reverso de la cédula.',
        };
      }

      const backRunDigits = this.getRunDigits(backRun);
      console.log('[OCR][document-upload] frontRunDigits:', frontRunDigits, 'backRunDigits:', backRunDigits);

      if (!frontRunDigits || !backRunDigits || frontRunDigits !== backRunDigits) {
        return {
          valid: false,
          frontText,
          backText,
          frontRun: frontRunFull,
          backRun,
          error: `El RUN del frente (${frontRunDigits || 'N/A'}) no coincide con el RUN detectado en el reverso (${backRunDigits || 'N/A'}).`,
        };
      }

      return {
        valid: true,
        frontRun: frontRunFull,
        backRun,
        frontText,
        backText,
      };
    } catch (error: any) {
      return {
        valid: false,
        error: `No se pudo completar el OCR del documento: ${error?.message || error}`,
      };
    }
  }

  private async validateDocumentCandidate(file: File, side: 'front' | 'back'): Promise<{ valid: boolean; reason?: string }> {
    try {
      const dimensions = await this.getImageDimensions(file);
      const aspectRatio = dimensions.width / dimensions.height;
      const minPixels = 200 * 200;
      const totalPixels = dimensions.width * dimensions.height;

      if (totalPixels < minPixels) {
        return { valid: false, reason: `La imagen ${side === 'front' ? 'frontal' : 'posterior'} es demasiado pequeña.` };
      }

      if (aspectRatio < 0.6 || aspectRatio > 3.5) {
        return { valid: false, reason: `La imagen ${side === 'front' ? 'frontal' : 'posterior'} no tiene la proporción esperada de una cédula.` };
      }

      const image = await this.loadImageElement(file);
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d', { willReadFrequently: true });
      if (!ctx) {
        return { valid: true };
      }

      const sampleWidth = 320;
      const sampleHeight = Math.max(1, Math.floor((dimensions.height * sampleWidth) / dimensions.width));
      canvas.width = sampleWidth;
      canvas.height = sampleHeight;
      ctx.drawImage(image, 0, 0, sampleWidth, sampleHeight);

      const quality = analyzeDocumentImageQuality(
        ctx.getImageData(0, 0, sampleWidth, sampleHeight).data,
        sampleWidth,
        sampleHeight
      );

      if (!quality.valid) {
        return {
          valid: false,
          reason: `La imagen ${side === 'front' ? 'frontal' : 'posterior'} no tiene la calidad suficiente para una cédula. ${quality.reason ?? 'Revisa la iluminación, enfoque y encuadre.'}`,
        };
      }

      return { valid: true };
    } catch (error) {
      console.warn('[OCR][document-upload] Validación previa falló, se continúa con OCR:', error);
      return { valid: true };
    }
  }

  private loadImageElement(file: File): Promise<HTMLImageElement> {
    return new Promise((resolve, reject) => {
      const url = URL.createObjectURL(file);
      const img = new Image();
      img.onload = () => {
        URL.revokeObjectURL(url);
        resolve(img);
      };
      img.onerror = () => {
        URL.revokeObjectURL(url);
        reject(new Error('No se pudo cargar la imagen'));
      };
      img.src = url;
    });
  }

  private async extractTextFromImage(file: File): Promise<string> {
    console.log('[OCR][document-upload] Procesando OCR de archivo:', {
      name: file?.name,
      size: file?.size,
      type: file?.type,
    });

    const worker = await createWorker('spa+eng');
    try {
      const imageUrl = URL.createObjectURL(file);
      const { data } = await worker.recognize(imageUrl, { rotateAuto: true });
      URL.revokeObjectURL(imageUrl);
      console.log('[OCR][document-upload] Texto OCR extraído del archivo:', data?.text || '');
      return data?.text || '';
    } catch (error: any) {
      console.error('[OCR][document-upload] Error en OCR del archivo:', error);
      throw error;
    } finally {
      await worker.terminate();
    }
  }

  private normalizeOcrText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\r\n?/g, '\n')
      .replace(/[ \t]+/g, ' ')
      .replace(/\n{2,}/g, '\n')
      .trim();
  }

  public async extractRunFromFrontImage(file: File): Promise<string | null> {
    try {
      const backendRun = await this.extractRunFromFrontWithTextract(file);
      if (backendRun) {
        console.log('[OCR][document-upload] RUN extraído por Textract:', backendRun);
        return backendRun;
      }

      const text = await this.extractTextFromImage(file);
      const frontText = this.normalizeOcrText(text);

      console.log('[OCR][document-upload] OCR completo del frente (texto crudo):', text);
      console.log('[OCR][document-upload] OCR completo del frente (texto normalizado):', frontText);

      const run = this.extractRunFromFront(frontText);
      console.log('[OCR][document-upload] Resultado parseo RUN desde texto frontal:', { frontText, run });

      if (run) {
        const digits = this.getRunDigits(run);
        console.log('[OCR][document-upload] RUN frontal convertido a dígitos:', digits);
        return digits;
      }

      const runFromLowerLeft = await this.extractRunFromLowerLeftFront(file);
      console.log('[OCR][document-upload] Resultado RUN desde ROI inferior izquierdo:', runFromLowerLeft);
      if (runFromLowerLeft) {
        const digits = this.getRunDigits(runFromLowerLeft);
        console.log('[OCR][document-upload] RUN del ROI inferior izquierdo convertido a dígitos:', digits);
        return digits;
      }

      return null;
    } catch (error) {
      console.warn('[OCR][document-upload] No se pudo extraer RUN del frente:', error);
      return null;
    }
  }

  private async extractFrontTextWithTextract(file: File): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', 'IDENTITY_DOCUMENT');
      formData.append('side', 'front');

      console.log('[OCR][textract] Intentando extracción vía backend AWS Textract');
      const response: any = await firstValueFrom(
        this.http.post(`${this.API_URL}/extract-run`, formData)
      );

      const textFromResponse =
        response?.text ||
        response?.frontText ||
        response?.data?.text ||
        response?.data?.frontText ||
        response?.result?.text ||
        response?.result?.frontText;

      if (typeof textFromResponse === 'string' && textFromResponse.trim()) {
        return textFromResponse;
      }

      return null;
    } catch (error: any) {
      const status = error?.status ?? 'unknown';
      console.warn('[OCR][textract] AWS Textract no disponible en backend, usando OCR local:', {
        status,
        message: error?.message || 'No disponible'
      });
      return null;
    }
  }

  private async extractBackTextWithTextract(file: File): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', 'IDENTITY_DOCUMENT');
      formData.append('side', 'back');

      const response: any = await firstValueFrom(
        this.http.post(`${this.API_URL}/extract-run`, formData)
      );

      const textFromResponse =
        response?.text ||
        response?.backText ||
        response?.data?.text ||
        response?.data?.backText ||
        response?.result?.text ||
        response?.result?.backText;

      if (typeof textFromResponse === 'string' && textFromResponse.trim()) {
        return textFromResponse;
      }

      return null;
    } catch (error: any) {
      const status = error?.status ?? 'unknown';
      console.warn('[OCR][textract] AWS Textract no disponible para reverso, usando OCR local:', {
        status,
        message: error?.message || 'No disponible'
      });
      return null;
    }
  }

  private async extractRunFromFrontWithTextract(file: File): Promise<string | null> {
    try {
      const formData = new FormData();
      formData.append('file', file);
      formData.append('document_type', 'IDENTITY_DOCUMENT');
      formData.append('side', 'front');

      console.log('[OCR][textract] Intentando extracción vía backend AWS Textract');
      const response: any = await firstValueFrom(
        this.http.post(`${this.API_URL}/extract-run`, formData)
      );

      const runFromResponse =
        response?.run ||
        response?.frontRun ||
        response?.data?.run ||
        response?.data?.frontRun ||
        response?.result?.run ||
        response?.result?.frontRun;

      if (typeof runFromResponse === 'string' && runFromResponse.trim()) {
        return this.getRunDigits(runFromResponse);
      }

      const textFromResponse =
        response?.text ||
        response?.frontText ||
        response?.data?.text ||
        response?.data?.frontText ||
        response?.result?.text ||
        response?.result?.frontText;

      if (typeof textFromResponse === 'string') {
        const parsed = this.extractRunFromFront(this.normalizeOcrText(textFromResponse));
        if (parsed) {
          return this.getRunDigits(parsed);
        }
      }

      return null;
    } catch (error: any) {
      const status = error?.status ?? 'unknown';
      console.warn('[OCR][textract] AWS Textract no disponible en backend, usando OCR local:', {
        status,
        message: error?.message || 'No disponible'
      });
      return null;
    }
  }

  private async extractRunFromLowerLeftFront(file: File): Promise<string | null> {
    try {
      const img = await this.loadImageElement(file);
      const lowerLeftCanvas = document.createElement('canvas');
      const lowerLeftCtx = lowerLeftCanvas.getContext('2d', { willReadFrequently: true });
      if (!lowerLeftCtx) return null;

      const cropX = 0;
      const cropY = Math.floor(img.height * 0.38);
      const cropWidth = Math.floor(img.width * 0.75);
      const cropHeight = Math.floor(img.height * 0.55);

      lowerLeftCanvas.width = Math.max(600, cropWidth);
      lowerLeftCanvas.height = Math.max(260, cropHeight);

      lowerLeftCtx.clearRect(0, 0, lowerLeftCanvas.width, lowerLeftCanvas.height);
      lowerLeftCtx.filter = 'contrast(260%) brightness(120%) grayscale(1)';
      lowerLeftCtx.drawImage(img, cropX, cropY, cropWidth, cropHeight, 0, 0, lowerLeftCanvas.width, lowerLeftCanvas.height);
      lowerLeftCtx.filter = 'none';

      const imageData = lowerLeftCtx.getImageData(0, 0, lowerLeftCanvas.width, lowerLeftCanvas.height);
      const data = imageData.data;
      let minX = lowerLeftCanvas.width;
      let minY = lowerLeftCanvas.height;
      let maxX = 0;
      let maxY = 0;
      let darkPixels = 0;

      for (let y = 0; y < lowerLeftCanvas.height; y++) {
        for (let x = 0; x < lowerLeftCanvas.width; x++) {
          const index = (y * lowerLeftCanvas.width + x) * 4;
          const r = data[index];
          const g = data[index + 1];
          const b = data[index + 2];
          const brightness = (r + g + b) / 3;
          const isDark = brightness < 180;

          if (isDark) {
            darkPixels++;
            if (x < minX) minX = x;
            if (x > maxX) maxX = x;
            if (y < minY) minY = y;
            if (y > maxY) maxY = y;
          }
        }
      }

      if (darkPixels < 120) {
        console.log('[OCR][document-upload] Bloque inferior izquierdo sin suficientes píxeles oscuros para RUN:', {
          darkPixels,
          rect: { minX, minY, maxX, maxY },
          source: { width: img.width, height: img.height }
        });
        return null;
      }

      const pad = 20;
      const boxX = Math.max(0, minX - pad);
      const boxY = Math.max(0, minY - pad);
      const boxW = Math.min(lowerLeftCanvas.width - boxX, maxX - minX + pad * 2);
      const boxH = Math.min(lowerLeftCanvas.height - boxY, maxY - minY + pad * 2);

      const cropCanvas = document.createElement('canvas');
      cropCanvas.width = Math.max(280, boxW);
      cropCanvas.height = Math.max(120, boxH);
      const cropCtx = cropCanvas.getContext('2d', { willReadFrequently: true });
      if (!cropCtx) return null;

      cropCtx.drawImage(
        lowerLeftCanvas,
        boxX,
        boxY,
        boxW,
        boxH,
        0,
        0,
        cropCanvas.width,
        cropCanvas.height
      );

      const worker = await createWorker('spa+eng');
      try {
        await worker.setParameters({
          tessedit_char_whitelist: '0123456789Kk.- ',
          tessedit_pageseg_mode: PSM.SINGLE_LINE,
        });

        const dataUrl = cropCanvas.toDataURL('image/jpeg', 1);
        const { data } = await worker.recognize(dataUrl, { rotateAuto: true });
        const rawCropText = data?.text || '';
        const cropText = this.normalizeOcrText(rawCropText);

        console.log('[OCR][document-upload] ROI RUN dinámico (crudo):', rawCropText);
        console.log('[OCR][document-upload] ROI RUN dinámico (normalizado):', cropText);
        console.log('[OCR][document-upload] ROI RUN dinámico (bbox):', {
          darkPixels,
          box: { x: boxX, y: boxY, width: boxW, height: boxH },
          source: { width: lowerLeftCanvas.width, height: lowerLeftCanvas.height }
        });

        const exact = this.extractRunFromFront(cropText);
        if (exact) {
          return this.getRunDigits(exact);
        }

        const compact = cropText.replace(/[^0-9Kk.\-\s]/g, '');
        const compactMatch = compact.match(/(\d{1,2}[\.\s]*\d{3}[\.\s]*\d{3}[\.\-\s]*\d|\d{7,8}[kK]?)/);
        if (compactMatch?.[1]) {
          return this.getRunDigits(compactMatch[1]);
        }

        return null;
      } finally {
        await worker.terminate();
      }
    } catch (error) {
      console.warn('[OCR][document-upload] ROI dinámico del RUN falló:', error);
      return null;
    }
  }

  private normalizeRun(run: string): string {
    return normalizeRunToDigits(run);
  }

  private getRunDigits(run: string): string {
    return normalizeRunToDigits(run);
  }

  private logBackRunMatch(backText: string, expectedDigits: string, matchedRun: string | null): void {
    const lines = (backText ?? '')
      .split(/\r?\n/)
      .map(line => line.trim())
      .filter(Boolean);

    const lowerRows = lines.slice(-3);
    let foundRowIndex: number | null = null;
    let foundRowText: string | null = null;

    for (let index = 0; index < lowerRows.length; index++) {
      const line = lowerRows[index];
      const normalized = normalizeRunToDigits(line);
      if (normalized && (normalized === expectedDigits || normalized.includes(expectedDigits))) {
        foundRowIndex = lines.length - lowerRows.length + index;
        foundRowText = line;
        break;
      }
    }

    console.log('[OCR][document-upload] RUN en reverso:', {
      originalRun: expectedDigits,
      formattedRun: expectedDigits,
      foundRowIndex,
      foundRowText,
      matchedRun,
      lowerRows,
    });
  }

  private findMatchingRunInText(text: string, expectedDigits?: string): string | null {
    const candidates = this.extractRunCandidates(text);
    const plainDigits = text.replace(/\D/g, '');

    if (candidates.length === 0 && !expectedDigits) {
      return null;
    }

    if (expectedDigits) {
      const exactMatch = candidates.find(candidate => this.getRunDigits(candidate) === expectedDigits);
      if (exactMatch) {
        return exactMatch;
      }

      const substringMatch = candidates.find(candidate => {
        const candidateDigits = this.getRunDigits(candidate);
        return candidateDigits && (candidateDigits.includes(expectedDigits) || expectedDigits.includes(candidateDigits));
      });
      if (substringMatch) {
        return substringMatch;
      }

      if (plainDigits.includes(expectedDigits)) {
        return expectedDigits;
      }

      const normalizedText = this.normalizeOcrText(text);
      const backRunRegex = /([0-9]{7,8}[Kk]?)/g;
      const directBackMatch = [...normalizedText.matchAll(backRunRegex)]
        .map(match => this.getRunDigits(match[1]))
        .find(candidate => candidate.includes(expectedDigits) || expectedDigits.includes(candidate));
      if (directBackMatch) {
        return directBackMatch;
      }
    }

    return candidates[0] ?? null;
  }

  private extractRunCandidates(text: string): string[] {
    const patterns = [
      /(?:RUN|RUT)[^0-9K]{0,12}([0-9]{1,2}(?:[.\s]?[0-9]{3}){2}[-.]?[0-9K])/gi,
      /(?:RUN|RUT)[^0-9K]{0,12}([0-9]{7,8}[Kk]?)/gi,
      /([0-9]{1,2}(?:[.\s]?[0-9]{3}){2}[-.]?[0-9K])/g,
      /([0-9]{7,8}[Kk]?)/g,
      /(?:^|\n|\s)(\d{7,8})(?=\s|\n|$)/gim,
      /(?:^|[^\d])(\d{7,8})(?=[^\d]|$)/g,
      /(\d{7,9}[Kk]?)/g,
      /(\d{6,10})/g,
    ];

    const candidates = new Map<string, number>();

    for (const pattern of patterns) {
      for (const match of text.matchAll(pattern)) {
        const rawValue = match[1] ?? match[0];
        if (!rawValue) continue;

        const normalized = this.normalizeRun(rawValue);
        const digitsOnly = this.getRunDigits(normalized);
        const score = this.scoreRunCandidate(rawValue, digitsOnly);

        if (digitsOnly.length >= 7 && digitsOnly.length <= 8) {
          const existing = candidates.get(digitsOnly) ?? 0;
          candidates.set(digitsOnly, Math.max(existing, score));
        }
      }
    }

    const plainDigits = text.replace(/\D/g, '');
    if (plainDigits.length >= 7 && plainDigits.length <= 8) {
      const existing = candidates.get(plainDigits) ?? 0;
      candidates.set(plainDigits, Math.max(existing, this.scoreRunCandidate(plainDigits, plainDigits)));
    }

    const result = [...candidates.entries()]
      .sort((a, b) => b[1] - a[1] || b[0].length - a[0].length)
      .map(([candidate]) => candidate);

    console.log('[OCR][document-upload] RUN candidates detectados:', result);
    return result;
  }

  private scoreRunCandidate(rawValue: string, digitsOnly: string): number {
    const normalized = rawValue.replace(/\s+/g, '').replace(/\./g, '');
    let score = 0;

    if (/\d{1,2}[-.]?\d{3}[-.]?\d{3}[-.]?\d/.test(normalized) || /\d{7,8}[kK]?/.test(normalized)) {
      score += 100;
    }

    if (/^\d{2}\d{3}\d{3}/.test(digitsOnly)) {
      score += 80;
    }

    if (/^\d{7,8}$/.test(digitsOnly)) {
      score += 40;
    }

    if (normalized.includes('K') || normalized.includes('k')) {
      score += 20;
    }

    if (/\d{2}[\s.]*\d{3}[\s.]*\d{3}/.test(normalized)) {
      score += 60;
    }

    if (/^(0[1-9]|[12]\d|3[01])/.test(digitsOnly.slice(0, 2))) {
      score -= 30;
    }

    if (/^(19|20)\d\d$/.test(digitsOnly)) {
      score -= 50;
    }

    if (/^(0[1-9]|[12]\d|3[01])\d{1,2}\d{4}$/.test(digitsOnly)) {
      score -= 40;
    }

    return score;
  }

  private extractRunFromFront(frontText: string): string | null {
    const lowerText = frontText.toLowerCase();

    // Los separadores excluyen \n para no capturar dígitos de líneas distintas (p.ej. fechas + siguiente campo).
    const nearPhotoPatterns = [
      /(?:run|rut)[^\n]{0,30}?([0-9]{1,2}[ .]*[0-9]{3}[ .]*[0-9]{3}[ .-]*[0-9k])/i,
      /(?:run|rut)[^\n]{0,30}?([0-9]{7,8}[k]?)/i,
      /(?:\bnumero\s*documento\b|\bnumero\b)[^\n]{0,20}?([0-9]{7,8}[k]?)/i,
      /([0-9]{1,2}[ .]*[0-9]{3}[ .]*[0-9]{3}[ .-]*[0-9k])(?=\s*(?:\n|$))/i,
      /([0-9]{7,8}[k]?)(?=\s*(?:\n|$))/i,
    ];

    for (const pattern of nearPhotoPatterns) {
      const match = frontText.match(pattern);
      if (match?.[1]) {
        return this.normalizeRun(match[1]);
      }
    }

    const runLabelIndex = lowerText.indexOf('run');
    const labelIndex = lowerText.indexOf('rut');
    const relevantIndex = Math.max(runLabelIndex, labelIndex);

    if (relevantIndex >= 0) {
      const tail = frontText.slice(relevantIndex, relevantIndex + 250);
      const tailCandidate = tail.match(/([0-9]{1,2}[ .]*[0-9]{3}[ .]*[0-9]{3}[ .-]*[0-9k]?|[0-9]{7,8}[k]?)/i);
      if (tailCandidate?.[1]) {
        return this.normalizeRun(tailCandidate[1]);
      }
    }

    const candidate = this.extractRunCandidates(frontText)[0];
    return candidate ?? null;
  }

  private extractRunFromBack(backText: string): string | null {
    return this.findMatchingRunInText(backText);
  }

  /**
   * Upload document to backend (backend handles Cloudinary upload)
   */
  private shouldRetryUpload(error: HttpErrorResponse): boolean {
    if (error.status === 0) return true;

    const message = (error.message || '').toLowerCase();
    return message.includes('err_connection_closed')
      || message.includes('network error')
      || message.includes('connection closed')
      || message.includes('connection reset');
  }

  uploadDocument(file: File, documentType: string): Observable<any> {
    return new Observable(observer => {
      this.validateImage(file)
        .then(validation => {
          if (!validation.valid) {
            observer.error(new Error(validation.error));
            return;
          }

          if (validation.warnings && validation.warnings.length > 0) {
            console.warn('[UPLOAD] Warnings:', validation.warnings);
          }

          const formData = new FormData();
          formData.append('document_type', documentType);
          formData.append('file', file);

          this.http.post(`${this.API_URL}/upload-signed`, formData)
            .pipe(
              retryWhen(errors =>
                errors.pipe(
                  scan((attempt, error) => {
                    const httpError = error as HttpErrorResponse;

                    if (!this.shouldRetryUpload(httpError) || attempt >= 1) {
                      throw error;
                    }

                    console.warn('[UPLOAD] Retry due to transient connection reset on signed upload', {
                      documentType,
                      status: httpError.status,
                      message: httpError.message,
                      attempt: attempt + 1,
                    });

                    return attempt + 1;
                  }, 0),
                  delayWhen(() => timer(1500))
                )
              ),
              map((response) => response),
              catchError((err) => {
                console.error('Document upload failed:', err);
                return throwError(() => err);
              })
            )
            .subscribe({
              next: (response) => {
                observer.next(response);
                observer.complete();
              },
              error: (err) => {
                observer.error(err);
              }
            });
        })
        .catch(error => {
          observer.error(error);
        });
    });
  }

  /**
   * Get face preview before verification
   * Returns base64 encoded images of detected faces
   * FIX ERROR 431: Convierte base64 a Data URL con prefijo correcto
   */
  getFacePreview(selfieDocumentId: number, idDocumentId: number): Observable<any> {
    return this.http.post(`${this.API_URL}/face-preview`, {
      selfie_document_id: selfieDocumentId,
      id_document_id: idDocumentId
    });
  }

  /**
   * Initiate face verification
   * Sends JSON body to match backend Pydantic model validation
   */
  initiateVerification(
    selfieDocumentId: number,
    idDocumentId: number
  ): Observable<any> {
    const requestBody = {
      selfie_document_id: selfieDocumentId,
      id_document_id: idDocumentId
    };

    return this.http.post(
      `${this.API_URL}/initiate-verification`,
      requestBody,
      {
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );
  }

  /**
   * Get current verification status
   */
  getVerificationStatus(): Observable<any> {
    return this.http.get(`${this.API_URL}/verification-status`);
  }
}
