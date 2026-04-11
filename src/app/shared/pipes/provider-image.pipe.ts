import { Pipe, PipeTransform } from '@angular/core';

@Pipe({ name: 'providerImage', standalone: true })
export class ProviderImagePipe implements PipeTransform {
  transform(value: string | null | undefined): string {
    if (!value) return '';
    
    // URLs completas (HTTP/HTTPS)
    if (value.startsWith('http://') || value.startsWith('https://')) {
      return value;
    }
    
    // Data URIs (base64 inline)
    if (value.startsWith('data:')) {
      return value;
    }
    
    // Cloudinary paths relativos (ej: "v1234567890/provider_123.jpg")
    if (value.includes('cloudinary') || value.match(/^v\d+\//)) {
      return `https://res.cloudinary.com/tu-cloud-name/image/upload/${value}`;
    }
    
    // Raw base64 string — add data URI prefix
    if (this.isBase64(value)) {
      return 'data:image/jpeg;base64,' + value;
    }
    
    // Si parece una ruta relativa, intentar como URL
    if (value.startsWith('/')) {
      return value;
    }
    
    // Fallback: retornar vacío para evitar broken images
    return '';
  }

  private isBase64(str: string): boolean {
    try {
      return btoa(atob(str)) === str;
    } catch {
      return false;
    }
  }
}
