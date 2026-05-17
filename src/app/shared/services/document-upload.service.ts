import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { environment } from '../../../environments/environment';

interface CloudinarySignature {
  signature: string;
  timestamp: number;
  api_key: string;
  cloud_name: string;
  upload_preset: string;
  folder: string;
  public_id: string;
}

interface ImageValidationResult {
  valid: boolean;
  error?: string;
  warnings?: string[];
}

@Injectable({
  providedIn: 'root'
})
export class DocumentUploadService {
  private readonly API_URL = `${environment.apiUrl}/documents`;

  // Image validation constraints
  private readonly MAX_FILE_SIZE = 5 * 1024 * 1024; // 5MB
  private readonly ALLOWED_FORMATS = ['image/jpeg', 'image/png', 'image/webp'];
  private readonly MIN_WIDTH = 200;
  private readonly MIN_HEIGHT = 200;
  private readonly MAX_WIDTH = 8000;
  private readonly MAX_HEIGHT = 8000;

  constructor(private http: HttpClient) {}

  /**
   * Validate image before upload
   * Checks format, size, dimensions
   */
  async validateImage(file: File): Promise<ImageValidationResult> {
    // Check file size
    if (file.size > this.MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `Archivo demasiado grande (${(file.size / 1024 / 1024).toFixed(2)}MB). Máximo: 5MB`
      };
    }

    // Check file format
    if (!this.ALLOWED_FORMATS.includes(file.type)) {
      return {
        valid: false,
        error: `Formato no permitido. Permitidos: JPEG, PNG, WebP. Recibido: ${file.type}`
      };
    }

    // Check image dimensions
    try {
      const dimensions = await this.getImageDimensions(file);
      
      if (dimensions.width < this.MIN_WIDTH || dimensions.height < this.MIN_HEIGHT) {
        return {
          valid: false,
          error: `Imagen muy pequeña (${dimensions.width}x${dimensions.height}). Mínimo: 200x200`
        };
      }
      if (dimensions.width > this.MAX_WIDTH || dimensions.height > this.MAX_HEIGHT) {
        return {
          valid: false,
          error: `Imagen muy grande (${dimensions.width}x${dimensions.height}). Máximo: 8000x8000`
        };
      }
      
      // Warn if image is very small (but valid)
      const warnings: string[] = [];
      if (dimensions.width < 400 || dimensions.height < 400) {
        warnings.push('Imagen pequeña. Se recomienda al menos 400x400 píxeles');
      }
      
      return {
        valid: true,
        warnings: warnings.length > 0 ? warnings : undefined
      };
    } catch (error) {
      return {
        valid: false,
        error: `Error al validar dimensiones de imagen: ${error}`
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
          reject(new Error('Error al cargar imagen'));
        };
        
        img.src = event.target?.result as string;
      };
      
      reader.onerror = () => {
        reject(new Error('Error al leer archivo'));
      };
      
      reader.readAsDataURL(file);
    });
  }

  /**
   * Get upload signature from backend for direct Cloudinary upload
   */
  generateUploadSignature(documentType: string = 'portfolio'): Observable<CloudinarySignature> {
    const formData = new FormData();
    formData.append('document_type', documentType);
    
    return this.http.post<CloudinarySignature>(
      `${this.API_URL}/generate-upload-signature`,
      formData
    );
  }
}
