import { calculateDocumentCaptureRect } from './document-verification.component';

describe('calculateDocumentCaptureRect', () => {
  it('should expand the crop from the visible guide instead of from the canvas center', () => {
    const rect = calculateDocumentCaptureRect({
      canvasWidth: 1280,
      canvasHeight: 720,
      videoWidth: 1280,
      videoHeight: 720,
      videoRect: { left: 0, top: 0, width: 1280, height: 720 },
      guideRect: { left: 160, top: 90, width: 960, height: 540 },
      marginRatio: 0.18,
    });

    expect(rect.left).toBeLessThan(160);
    expect(rect.top).toBeGreaterThan(90);
    expect(rect.width).toBeGreaterThan(960);
    expect(rect.height).toBeGreaterThan(540);
    expect(rect.left).toBeGreaterThanOrEqual(0);
    expect(rect.top).toBeGreaterThanOrEqual(0);
    expect(rect.left + rect.width).toBeLessThanOrEqual(1280);
    expect(rect.top + rect.height).toBeLessThanOrEqual(720);
  });

  it('should keep the full document height when lowering the crop to align with the guide', () => {
    const rect = calculateDocumentCaptureRect({
      canvasWidth: 1280,
      canvasHeight: 720,
      videoWidth: 1280,
      videoHeight: 720,
      videoRect: { left: 0, top: 0, width: 1280, height: 720 },
      guideRect: { left: 180, top: 100, width: 920, height: 500 },
      marginRatio: 0.1,
    });

    expect(rect.top).toBeGreaterThan(100);
    expect(rect.height).toBeGreaterThanOrEqual(420);
  });
});
