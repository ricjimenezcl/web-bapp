import { calculateDocumentCaptureRect } from './document-verification.component';
import { analyzeDocumentImageQuality, findMatchingRunInBackRows, hasRequiredFrontIdFields } from '../../../../core/services/document-upload.service';

function createSyntheticDocumentImage({ width, height, background, textDarkness }: { width: number; height: number; background: number; textDarkness: number; }) {
  const data = new Uint8ClampedArray(width * height * 4);

  for (let y = 0; y < height; y++) {
    for (let x = 0; x < width; x++) {
      const index = (y * width + x) * 4;
      let value = background;

      const inContentArea = y > height * 0.12 && y < height * 0.9 && x > width * 0.12 && x < width * 0.88;
      const isTopHeader = y > height * 0.18 && y < height * 0.26 && x > width * 0.2 && x < width * 0.8;
      const isLine1 = y > height * 0.28 && y < height * 0.36 && x > width * 0.2 && x < width * 0.82;
      const isLine2 = y > height * 0.40 && y < height * 0.48 && x > width * 0.2 && x < width * 0.72;
      const isLine3 = y > height * 0.52 && y < height * 0.60 && x > width * 0.2 && x < width * 0.68;
      const isLine4 = y > height * 0.64 && y < height * 0.72 && x > width * 0.2 && x < width * 0.56;
      const isDocumentBorder = (x < 8 || x > width - 8 || y < 8 || y > height - 8) && inContentArea;

      if (inContentArea && (isTopHeader || isLine1 || isLine2 || isLine3 || isLine4 || isDocumentBorder)) {
        value = textDarkness;
      }

      if (x > width * 0.18 && x < width * 0.22 && y > height * 0.18 && y < height * 0.82) {
        value = textDarkness;
      }

      if (x > width * 0.76 && x < width * 0.8 && y > height * 0.18 && y < height * 0.82) {
        value = textDarkness;
      }

      data[index] = value;
      data[index + 1] = value;
      data[index + 2] = value;
      data[index + 3] = 255;
    }
  }

  return data;
}

describe('calculateDocumentCaptureRect', () => {
  it('should match the visible guide exactly without cropping the document top or bottom', () => {
    const rect = calculateDocumentCaptureRect({
      canvasWidth: 1280,
      canvasHeight: 720,
      videoWidth: 1280,
      videoHeight: 720,
      videoRect: { left: 0, top: 0, width: 1280, height: 720 },
      guideRect: { left: 160, top: 90, width: 960, height: 540 },
      marginRatio: 0.18,
    });

    expect(rect.left).toBe(160);
    expect(rect.top).toBe(90);
    expect(rect.width).toBe(960);
    expect(rect.height).toBe(540);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.left + rect.width).toBeLessThanOrEqual(1280);
    expect(rect.top + rect.height).toBeLessThanOrEqual(720);
  });
});

describe('analyzeDocumentImageQuality', () => {
  it('rejects flat or overexposed document images that do not contain usable ID content', () => {
    const data = new Uint8ClampedArray(640 * 400 * 4);
    for (let i = 0; i < data.length; i += 4) {
      const value = 245;
      data[i] = value;
      data[i + 1] = value;
      data[i + 2] = value;
      data[i + 3] = 255;
    }

    const result = analyzeDocumentImageQuality(data, 640, 400);

    expect(result.valid).toBeFalse();
    expect(result.reason).toMatch(/calidad|sobreexpuesta|oscura|contenido/i);
  });

  it('accepts a document image with sufficient contrast and usable content', () => {
    const data = createSyntheticDocumentImage({
      width: 640,
      height: 400,
      background: 245,
      textDarkness: 30,
    });

    const result = analyzeDocumentImageQuality(data, 640, 400);

    expect(result.valid).toBeTrue();
    expect(result.score).toBeGreaterThan(0.4);
  });

  it('finds the formatted RUN inside the bottom three rows of the back document', () => {
    const backText = [
      'SECTOR COMUNA',
      'REGISTRO CIVIL',
      '12345678',
      '98765432',
      '449832',
    ].join('\n');

    const result = findMatchingRunInBackRows(backText, '12345678');

    expect(result).toBe('12345678');
  });

  it('accepts the front OCR variants commonly returned by the Chilean ID', () => {
    const frontText = [
      'REPUBLICA DE CHILE',
      'CEDULA DE IDENTIDAD',
      'RUN 12 345 678-9',
      'SERVICIO DE REGISTRO CIVIL',
    ].join('\n');

    const missingFields = hasRequiredFrontIdFields(frontText);

    expect(missingFields).toEqual([]);
  });

  it('accepts the merged OCR string produced by Textract from the real front image', () => {
    const frontText = [
      'CÉDULA DE',
      'REPUBLICA DE CHILE',
      'IDENTIDAD',
      'SERVICIO DE REGISTRO GIVEL E IDENTIFICACION',
      'RUN 14.483.484-4',
    ].join('\n');

    const missingFields = hasRequiredFrontIdFields(frontText);

    expect(missingFields).toEqual([]);
  });

  it('accepts the exact merged OCR output seen in backend logs', () => {
    const frontText = 'CÉDULA DEREPUBLICA DE CHILEIDENTIDADSERVICIO DE REGISTRO GIVEL E IDENTIFICACIONAPELLIDOSJIMÉNEZLAZONOMBRESRICARDO ANDRÉSNACIONALIDADSEXOCHILENAMFECHA DE NACIMIENTONUMERO DOCUMENTO31 OCT 1974B61.845.711FECHA 08 EMISIONFECHA DE VENCIMIENTO03 NOV 202531 OCT 2034FIRMA DEL TITULARRON14.483.484-4DAY';

    const missingFields = hasRequiredFrontIdFields(frontText);

    expect(missingFields).toEqual([]);
  });

  it('accepts the OCR variant with SERVICIO DE REGISTRO GIVEL E IDENTIFICACION', () => {
    const frontText = [
      'REPUBLICA DE CHILE',
      'CEDULA DE IDENTIDAD',
      'RUN 14.483.484-4',
      'SERVICIO DE REGISTRO GIVEL E IDENTIFICACION',
    ].join('\n');

    const missingFields = hasRequiredFrontIdFields(frontText);

    expect(missingFields).toEqual([]);
  });

  it('accepts the real backend OCR string when words are merged with no spaces between labels', () => {
    const frontText = 'CÉDULA DEREPUBLICA DE CHILEIDENTIDADSERVICIO DE REGISTRO GIVEL E IDENTIFICACIONAPELLIDOSJIMÉNEZLAZONOMBRESRICARDO ANDRÉSNACIONALIDADSEXOCHILENAMFECHA DE NACIMIENTONUMERO DOCUMENTO31 OCT 1974B61.845.711FECHA 08 EMISIONFECHA DE VENCIMIENTO03 NOV 202531 OCT 2034FIRMA DEL TITULARRON14.483.484-4DAY';

    const missingFields = hasRequiredFrontIdFields(frontText);

    expect(missingFields).toEqual([]);
  });
});
