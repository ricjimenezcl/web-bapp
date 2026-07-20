import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';
import { createWorker } from 'tesseract.js';

interface ImageValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

export interface ChileanIdValidationResult {
  valid: boolean;
  error?: string;
  frontRun?: string;
  backRun?: string;
  frontText?: string;
  backText?: string;
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
    'CEDULA DE IDENTIDAD',
    'RUN',
    'SERVICIO DE REGISTRO CIVIL',
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
      
      if (dimensions.width < this.MIN_WIDTH || dimensions.height < this.MIN_HEIGHT) {
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
      const [frontTextRaw, backTextRaw] = await Promise.all([
        this.extractTextFromImage(frontFile),
        this.extractTextFromImage(backFile),
      ]);

      const frontText = this.normalizeOcrText(frontTextRaw);
      const backText = this.normalizeOcrText(backTextRaw);

      const missingFields = DocumentUploadService.FRONT_REQUIRED_FIELDS.filter(
        field => !frontText.includes(field)
      );

      if (missingFields.length > 0) {
        return {
          valid: false,
          frontText,
          backText,
          error: `La imagen frontal no corresponde a una cédula chilena válida. Faltan campos: ${missingFields.join(', ')}`,
        };
      }

      const frontRunFull = this.extractRunFromFront(frontText);
      if (!frontRunFull) {
        return {
          valid: false,
          frontText,
          backText,
          error: 'No se pudo extraer el RUN desde el frente de la cédula.',
        };
      }

      if (!backText.includes('CHL')) {
        return {
          valid: false,
          frontText,
          backText,
          error: 'La imagen posterior no contiene el patrón CHL esperado en la zona de caracteres.',
        };
      }

      const backRun = this.extractRunFromBack(backText);
      if (!backRun) {
        return {
          valid: false,
          frontText,
          backText,
          error: 'No se pudo extraer el RUN desde el reverso de la cédula.',
        };
      }

      const frontRunDigits = this.getRunDigits(frontRunFull);
      const backRunDigits = this.getRunDigits(backRun);

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

  private async extractTextFromImage(file: File): Promise<string> {
    const worker = await createWorker('spa+eng');
    try {
      const imageUrl = URL.createObjectURL(file);
      const { data } = await worker.recognize(imageUrl);
      URL.revokeObjectURL(imageUrl);
      return data?.text || '';
    } finally {
      await worker.terminate();
    }
  }

  private normalizeOcrText(text: string): string {
    return text
      .normalize('NFD')
      .replace(/[\u0300-\u036f]/g, '')
      .toUpperCase()
      .replace(/\s+/g, ' ')
      .trim();
  }

  private normalizeRun(run: string): string {
    return run.toUpperCase().replace(/[^0-9K]/g, '');
  }

  private getRunDigits(run: string): string {
    const normalized = this.normalizeRun(run);
    if (normalized.length <= 1) {
      return normalized;
    }
    // Mantener solo la parte numérica base sin dígito verificador
    return normalized.slice(0, -1);
  }

  private extractRunFromFront(frontText: string): string | null {
    const labeled = frontText.match(/(?:RUN|RUT)\s*[:.]?\s*([0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}-?[0-9K])/i);
    if (labeled?.[1]) {
      return this.normalizeRun(labeled[1]);
    }

    const generic = frontText.match(/\b([0-9]{1,2}\.?[0-9]{3}\.?[0-9]{3}-[0-9K])\b/i);
    if (generic?.[1]) {
      return this.normalizeRun(generic[1]);
    }

    return null;
  }

  private extractRunFromBack(backText: string): string | null {
    const compact = backText.replace(/\s+/g, '');

    const afterChl = compact.match(/CHL[^0-9K]*([0-9]{7,9}[0-9K]?)/i);
    if (afterChl?.[1]) {
      return this.normalizeRun(afterChl[1]);
    }

    const mrzLike = compact.match(/<([0-9]{7,9}[0-9K]?)</i);
    if (mrzLike?.[1]) {
      return this.normalizeRun(mrzLike[1]);
    }

    return null;
  }

  /**
   * Upload document to backend (backend handles Cloudinary upload)
   */
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

          this.http.post(`${this.API_URL}/upload-signed`, formData).subscribe({
            next: (response) => {
              observer.next(response);
              observer.complete();
            },
            error: (err) => {
              console.error('Document upload failed:', err);
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
