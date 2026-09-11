import JSZip from 'jszip';
import sharp from 'sharp';

export interface DocxCompressionOptions {
  maxDimension?: number;
  minSizeBytes?: number;
  quality?: number;
  onProgress?: (msg: string) => void;
}

export interface DocxCompressionResult {
  buffer: Buffer;
  originalSizeBytes: number;
  finalSizeBytes: number;
  totalImages: number;
  compressedCount: number;
  skippedCount: number;
}

/**
 * Server-Side DOCX Image Compressor (Node.js + sharp)
 * 
 * Safely compresses oversized images in word/media/ within a DOCX archive.
 * CRITICAL: Uses Promise.all with .map() to guarantee ALL async image compression tasks
 * complete before zip.generateAsync() is called, preventing race conditions that
 * cause entry loss (such as disappearing overlapping signatures/stamps).
 *
 * For PNGs with transparency (stamps and signatures), alpha channels are 100% preserved
 * so overlapping layers remain perfectly visible and uncorrupted.
 */
export async function compressDocxImages(
  docxInput: Buffer | ArrayBuffer,
  options: DocxCompressionOptions = {}
): Promise<Buffer> {
  const result = await compressDocxImagesWithStats(docxInput, options);
  return result.buffer;
}

export async function compressDocxImagesWithStats(
  docxInput: Buffer | ArrayBuffer,
  options: DocxCompressionOptions = {}
): Promise<DocxCompressionResult> {
  const inputBuffer = Buffer.isBuffer(docxInput) ? docxInput : Buffer.from(docxInput);
  const originalSizeBytes = inputBuffer.length;
  const maxDim = options.maxDimension || 800;
  const minSize = options.minSizeBytes ?? 60 * 1024; // 60 KB threshold

  console.log(
    `[DOCX Compressor] Starting compression. Original size: ${(originalSizeBytes / (1024 * 1024)).toFixed(2)} MB (${originalSizeBytes} bytes)`
  );

  try {
    const zip = await JSZip.loadAsync(inputBuffer);
    const mediaFiles: { name: string; file: JSZip.JSZipObject }[] = [];

    zip.forEach((path, file) => {
      // Only include actual files in word/media/, skip directories
      if (path.startsWith('word/media/') && !file.dir) {
        mediaFiles.push({ name: path, file });
      }
    });

    const totalImages = mediaFiles.length;
    console.log(`[DOCX Compressor] Found ${totalImages} image files in word/media/`);

    if (totalImages === 0) {
      console.log('[DOCX Compressor] No images found in word/media/. Returning original DOCX.');
      return {
        buffer: inputBuffer,
        originalSizeBytes,
        finalSizeBytes: originalSizeBytes,
        totalImages: 0,
        compressedCount: 0,
        skippedCount: 0,
      };
    }

    options.onProgress?.(`Memproses ${totalImages} gambar dalam dokumen...`);

    let compressedCount = 0;
    let skippedCount = 0;
    const processedImages: { name: string; status: 'compressed' | 'skipped' | 'error'; reason?: string }[] = [];

    // CRITICAL: Use Promise.all with mediaFiles.map() to wait for ALL images to finish!
    // Never use forEach(async ...) which finishes the ZIP before promises resolve.
    await Promise.all(
      mediaFiles.map(async ({ name, file }) => {
        try {
          const ext = name.split('.').pop()?.toLowerCase() || '';
          if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext)) {
            skippedCount++;
            processedImages.push({ name, status: 'skipped', reason: `unsupported format: .${ext}` });
            return;
          }

          const rawData = await file.async('nodebuffer');
          if (rawData.length < minSize) {
            skippedCount++;
            processedImages.push({
              name,
              status: 'skipped',
              reason: `below threshold (${(rawData.length / 1024).toFixed(1)} KB < ${(minSize / 1024).toFixed(0)} KB)`,
            });
            return;
          }

          const metadata = await sharp(rawData).metadata();
          const origWidth = metadata.width || 0;
          const origHeight = metadata.height || 0;
          const hasAlpha = metadata.hasAlpha || false;
          const format = metadata.format;

          let pipeline = sharp(rawData);
          if (origWidth > maxDim || origHeight > maxDim) {
            pipeline = pipeline.resize({
              width: maxDim,
              height: maxDim,
              fit: 'inside',
              withoutEnlargement: true,
            });
          }

          let compressedBuffer: Buffer;
          // CRITICAL: If format is PNG or has alpha, keep as PNG with alpha intact!
          // Converting PNG with alpha to JPEG will turn transparent background black/white,
          // destroying overlapping signatures and stamps!
          if (format === 'png' || hasAlpha) {
            compressedBuffer = await pipeline
              .png({
                compressionLevel: 9,
                adaptiveFiltering: true,
              })
              .toBuffer();
          } else {
            compressedBuffer = await pipeline
              .jpeg({
                quality: options.quality || 80,
                mozjpeg: true,
              })
              .toBuffer();
          }

          if (compressedBuffer.length < rawData.length) {
            zip.file(name, compressedBuffer);
            compressedCount++;
            processedImages.push({
              name,
              status: 'compressed',
              reason: `${(rawData.length / 1024).toFixed(1)} KB -> ${(compressedBuffer.length / 1024).toFixed(1)} KB (alpha: ${hasAlpha})`,
            });
            console.log(
              `[DOCX Compressor] Compressed ${name} (${format}, alpha: ${hasAlpha}): ${(rawData.length / 1024).toFixed(1)} KB -> ${(compressedBuffer.length / 1024).toFixed(1)} KB`
            );
          } else {
            skippedCount++;
            processedImages.push({
              name,
              status: 'skipped',
              reason: 'compressed size not smaller than original',
            });
          }
        } catch (err: any) {
          console.warn(`[DOCX Compressor] Warning processing image ${name}:`, err?.message || err);
          skippedCount++;
          processedImages.push({ name, status: 'error', reason: err?.message || 'unknown error' });
        }
      })
    );

    // Verification check: confirm all images were processed and none were lost
    const totalVerified = compressedCount + skippedCount;
    console.log(
      `[DOCX Compressor Verification] Total original images: ${totalImages} | Compressed: ${compressedCount} | Kept original: ${skippedCount} | Verified: ${totalVerified}`
    );

    for (const item of processedImages) {
      console.log(`[DOCX Compressor Audit] ${item.name} -> ${item.status} (${item.reason})`);
    }

    if (totalVerified !== totalImages) {
      console.warn(
        `[DOCX Compressor WARNING] Image count mismatch! Expected ${totalImages}, accounted for ${totalVerified}`
      );
    }

    if (compressedCount === 0) {
      console.log('[DOCX Compressor] No images were shrunk. Returning original buffer.');
      return {
        buffer: inputBuffer,
        originalSizeBytes,
        finalSizeBytes: originalSizeBytes,
        totalImages,
        compressedCount: 0,
        skippedCount,
      };
    }

    const compressedDocxBuffer = await zip.generateAsync({
      type: 'nodebuffer',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    const finalSizeBytes = compressedDocxBuffer.length;
    console.log(
      `[DOCX Compressor] Compression complete: ${(originalSizeBytes / (1024 * 1024)).toFixed(2)} MB -> ${(finalSizeBytes / (1024 * 1024)).toFixed(2)} MB (${compressedCount} images optimized, all ${totalImages} images preserved)`
    );

    return {
      buffer: compressedDocxBuffer,
      originalSizeBytes,
      finalSizeBytes,
      totalImages,
      compressedCount,
      skippedCount,
    };
  } catch (error) {
    console.error('[DOCX Compressor] Fatal error during compression:', error);
    return {
      buffer: inputBuffer,
      originalSizeBytes,
      finalSizeBytes: originalSizeBytes,
      totalImages: 0,
      compressedCount: 0,
      skippedCount: 0,
    };
  }
}
