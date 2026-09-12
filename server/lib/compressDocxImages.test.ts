import { describe, it, expect } from 'vitest';
import JSZip from 'jszip';
import sharp from 'sharp';
import { compressDocxImages, compressDocxImagesWithStats } from './compressDocxImages.js';

describe('Server DOCX Image Compressor (compressDocxImages)', () => {
  it('should process all images with Promise.all and not drop any entries due to race conditions', async () => {
    // Generate 2 transparent PNG images (like PROHE's stempel and tanda tangan)
    const stampBuffer = await sharp({
      create: {
        width: 1024,
        height: 1024,
        channels: 4,
        background: { r: 255, g: 0, b: 0, alpha: 0.5 },
      },
    })
      .png()
      .toBuffer();

    const signatureBuffer = await sharp({
      create: {
        width: 1200,
        height: 900,
        channels: 4,
        background: { r: 0, g: 0, b: 255, alpha: 0.3 },
      },
    })
      .png()
      .toBuffer();

    const smallLogoBuffer = await sharp({
      create: {
        width: 64,
        height: 64,
        channels: 4,
        background: { r: 0, g: 128, b: 0, alpha: 1 },
      },
    })
      .png()
      .toBuffer();

    // Create mock docx with the 3 images (2 overlapping signature/stamp + 1 small logo)
    const docxZip = new JSZip();
    docxZip.file('word/document.xml', '<w:document><w:body/></w:document>');
    docxZip.file('word/media/image2.png', signatureBuffer);
    docxZip.file('word/media/image3.png', stampBuffer);
    docxZip.file('word/media/image1.png', smallLogoBuffer);

    const originalDocxBuffer = await docxZip.generateAsync({ type: 'nodebuffer' });

    // Run compressor with stats
    const result = await compressDocxImagesWithStats(originalDocxBuffer, {
      maxDimension: 800,
      minSizeBytes: 1024, // 1 KB threshold for test
    });

    // Verification 1: total image count is strictly preserved
    expect(result.totalImages).toBe(3);
    expect(result.compressedCount + result.skippedCount).toBe(3);
    expect(result.finalSizeBytes).toBeLessThan(result.originalSizeBytes);

    // Verification 2: Check output ZIP contains all images intact
    const outputZip = await JSZip.loadAsync(result.buffer);
    const mediaFiles: string[] = [];
    outputZip.forEach((p, f) => {
      if (p.startsWith('word/media/') && !f.dir) mediaFiles.push(p);
    });

    expect(mediaFiles).toContain('word/media/image2.png');
    expect(mediaFiles).toContain('word/media/image3.png');
    expect(mediaFiles).toContain('word/media/image1.png');
    expect(mediaFiles.length).toBe(3);

    // Verification 3: Check that transparency (alpha channel) is preserved for overlapping stamp & signature
    const outSig = await outputZip.file('word/media/image2.png')!.async('nodebuffer');
    const outStamp = await outputZip.file('word/media/image3.png')!.async('nodebuffer');

    const metaSig = await sharp(outSig).metadata();
    const metaStamp = await sharp(outStamp).metadata();

    expect(metaSig.format).toBe('png');
    expect(metaSig.hasAlpha).toBe(true);
    expect(metaSig.width).toBeLessThanOrEqual(800);

    expect(metaStamp.format).toBe('png');
    expect(metaStamp.hasAlpha).toBe(true);
    expect(metaStamp.width).toBeLessThanOrEqual(800);
  });

  it('should handle docx with no images gracefully', async () => {
    const docxZip = new JSZip();
    docxZip.file('word/document.xml', '<w:document><w:body/></w:document>');
    const input = await docxZip.generateAsync({ type: 'nodebuffer' });

    const result = await compressDocxImages(input);
    expect(result).toBeDefined();
    expect(result.length).toBe(input.length);
  });

  it('should preserve both overlapping images (stempel image3.png and tanda tangan image2.png) with transparency', async () => {
    const fs = await import('fs');
    const path = await import('path');

    let sigBuf: Buffer;
    let stampBuf: Buffer;

    if (fs.existsSync('prohe_image2.png') && fs.existsSync('prohe_image3.png')) {
      sigBuf = fs.readFileSync('prohe_image2.png');
      stampBuf = fs.readFileSync('prohe_image3.png');
    } else {
      sigBuf = await sharp({
        create: { width: 1536, height: 1024, channels: 4, background: { r: 10, g: 20, b: 80, alpha: 0.9 } },
      }).png().toBuffer();
      stampBuf = await sharp({
        create: { width: 1024, height: 1024, channels: 4, background: { r: 180, g: 0, b: 20, alpha: 0.8 } },
      }).png().toBuffer();
    }

    const docxZip = new JSZip();
    docxZip.file('word/document.xml', '<w:document><w:body/></w:document>');
    docxZip.file('word/media/image2.png', sigBuf);
    docxZip.file('word/media/image3.png', stampBuf);

    const docxInput = await docxZip.generateAsync({ type: 'nodebuffer' });
    const stats = await compressDocxImagesWithStats(docxInput, { maxDimension: 800, minSizeBytes: 1024 });

    expect(stats.totalImages).toBe(2);
    expect(stats.compressedCount).toBe(2);
    expect(stats.skippedCount).toBe(0);

    const checkZip = await JSZip.loadAsync(stats.buffer);
    const mediaFiles: string[] = [];
    checkZip.forEach((p, f) => {
      if (p.startsWith('word/media/') && !f.dir) mediaFiles.push(p);
    });

    expect(mediaFiles).toHaveLength(2);
    expect(mediaFiles).toContain('word/media/image2.png');
    expect(mediaFiles).toContain('word/media/image3.png');

    const checkSig = await checkZip.file('word/media/image2.png')!.async('nodebuffer');
    const checkStamp = await checkZip.file('word/media/image3.png')!.async('nodebuffer');

    const metaSig = await sharp(checkSig).metadata();
    const metaStamp = await sharp(checkStamp).metadata();

    // Verify both images are intact, valid, and retain transparency for overlap
    expect(metaSig.format).toBe('png');
    expect(metaSig.hasAlpha).toBe(true);
    expect(metaStamp.format).toBe('png');
    expect(metaStamp.hasAlpha).toBe(true);

    // Verify sizes reduced significantly
    expect(checkSig.length).toBeLessThan(sigBuf.length);
    expect(checkStamp.length).toBeLessThan(stampBuf.length);
  });
});
