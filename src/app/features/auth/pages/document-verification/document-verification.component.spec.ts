import { calculateDocumentCaptureRect } from './document-verification.component';

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
