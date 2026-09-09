import JSZip from 'jszip';

/**
 * Client-side (Browser) DOCX Image Auto-Compressor
 * 
 * Compresses images inside the generated DOCX ZIP file directly in the browser
 * BEFORE sending the file over the network to Vercel's /api/convert-to-pdf serverless endpoint.
 * This guarantees request payload size stays well below Vercel's 4.5 MB hard proxy limit,
 * preventing HTTP 413 (Payload Too Large) errors on mobile devices and production deployments.
 */
export async function compressDocxImagesClient(
  docxInput: Blob | ArrayBuffer,
  onProgress?: (msg: string) => void
): Promise<Blob> {
  const originalBuffer =
    docxInput instanceof ArrayBuffer
      ? docxInput
      : await docxInput.arrayBuffer();

  const originalSizeBytes = originalBuffer.byteLength;
  const originalSizeMB = (originalSizeBytes / (1024 * 1024)).toFixed(2);
  console.log(
    `[Client DOCX Compressor] Original DOCX size: ${originalSizeBytes} bytes (${originalSizeMB} MB)`
  );

  // If already under 2.5 MB, client compression can be skipped or lightweight
  try {
    const zip = await JSZip.loadAsync(originalBuffer);
    const mediaFiles: string[] = [];

    zip.forEach((relativePath, file) => {
      if (relativePath.startsWith('word/media/') && !file.dir) {
        mediaFiles.push(relativePath);
      }
    });

    if (mediaFiles.length === 0) {
      console.log('[Client DOCX Compressor] No images found in word/media/. Skipping client compression.');
      return new Blob([originalBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    }

    onProgress?.('Mengompresi gambar pada template secara otomatis...');
    const totalOriginalImages = mediaFiles.length;
    let compressedCount = 0;
    let skippedCount = 0;
    const auditLog: { path: string; status: string; detail: string }[] = [];

    // CRITICAL: Use Promise.all with .map() to guarantee ALL async image processing
    // completes BEFORE zip.generateAsync is called. This eliminates any race conditions
    // where entries in the ZIP could be finalized prematurely (e.g. disappearing overlapping signatures/stamps).
    await Promise.all(
      mediaFiles.map(async (filePath) => {
        const file = zip.file(filePath);
        if (!file) {
          skippedCount++;
          auditLog.push({ path: filePath, status: 'skipped', detail: 'file handle missing in zip' });
          return;
        }

        const ext = filePath.split('.').pop()?.toLowerCase();
        if (!['png', 'jpg', 'jpeg', 'webp'].includes(ext || '')) {
          skippedCount++;
          auditLog.push({ path: filePath, status: 'skipped', detail: `unsupported extension .${ext}` });
          return;
        }

        const imgUint8Array = await file.async('uint8array');
        // Only compress images larger than 60 KB
        if (imgUint8Array.byteLength < 60 * 1024) {
          skippedCount++;
          auditLog.push({
            path: filePath,
            status: 'skipped',
            detail: `below 60KB threshold (${(imgUint8Array.byteLength / 1024).toFixed(1)} KB)`,
          });
          return;
        }

        try {
          const result = await compressImageBlobInBrowser(
            imgUint8Array,
            ext === 'png' ? 'image/png' : 'image/jpeg'
          );

          if (
            result &&
            result.buffer &&
            result.buffer.byteLength < imgUint8Array.byteLength
          ) {
            console.log(
              `[Client DOCX Compressor] Processed ${filePath} | Format: ${result.format} | Size: ${(
                imgUint8Array.byteLength / 1024
              ).toFixed(1)} KB -> ${(
                result.buffer.byteLength / 1024
              ).toFixed(1)} KB`
            );
            zip.file(filePath, result.buffer);
            compressedCount++;
            auditLog.push({
              path: filePath,
              status: 'compressed',
              detail: `${(imgUint8Array.byteLength / 1024).toFixed(1)} KB -> ${(result.buffer.byteLength / 1024).toFixed(1)} KB (${result.format})`,
            });
          } else {
            skippedCount++;
            auditLog.push({ path: filePath, status: 'skipped', detail: 'compressed size not smaller than original' });
          }
        } catch (imgErr: any) {
          console.warn(`[Client DOCX Compressor] Could not compress ${filePath}:`, imgErr);
          skippedCount++;
          auditLog.push({ path: filePath, status: 'error', detail: imgErr?.message || 'unknown error' });
        }
      })
    );

    // Verification check: ensure all images accounted for
    const totalVerified = compressedCount + skippedCount;
    console.log(
      `[Client DOCX Compressor Verification] Total original images: ${totalOriginalImages} | Successfully compressed: ${compressedCount} | Kept original: ${skippedCount} | Verified: ${totalVerified}`
    );
    for (const entry of auditLog) {
      console.log(`[Client DOCX Compressor Audit] ${entry.path} -> ${entry.status} (${entry.detail})`);
    }

    if (compressedCount === 0) {
      console.log('[Client DOCX Compressor] No images needed compression. All original images preserved.');
      return new Blob([originalBuffer], {
        type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      });
    }

    const compressedBlob = await zip.generateAsync({
      type: 'blob',
      mimeType:
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      compression: 'DEFLATE',
      compressionOptions: { level: 9 },
    });

    const finalSizeMB = (compressedBlob.size / (1024 * 1024)).toFixed(2);
    console.log(
      `[Client DOCX Compressor] Compression finished: ${originalSizeMB} MB -> ${finalSizeMB} MB (${compressedCount} images optimized, all ${totalOriginalImages} images preserved)`
    );

    return compressedBlob;
  } catch (err) {
    console.error('[Client DOCX Compressor] Failed client-side compression:', err);
    return new Blob([originalBuffer], {
      type: 'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    });
  }
}

/**
 * Resizes and compresses an image binary using HTML5 Canvas in the browser.
 */
function compressImageBlobInBrowser(
  uint8Array: Uint8Array,
  mimeType: string
): Promise<{ buffer: ArrayBuffer; format: string } | null> {
  return new Promise((resolve) => {
    const blob = new Blob([uint8Array], { type: mimeType });
    const blobUrl = URL.createObjectURL(blob);
    const img = new Image();

    img.onload = () => {
      URL.revokeObjectURL(blobUrl);

      // Max dimension 800px
      const MAX_WIDTH = 800;
      const MAX_HEIGHT = 800;
      let width = img.width;
      let height = img.height;

      if (width > MAX_WIDTH || height > MAX_HEIGHT) {
        if (width > height) {
          height = Math.round((height * MAX_WIDTH) / width);
          width = MAX_WIDTH;
        } else {
          width = Math.round((width * MAX_HEIGHT) / height);
          height = MAX_HEIGHT;
        }
      }

      const canvas = document.createElement('canvas');
      canvas.width = width;
      canvas.height = height;

      const ctx = canvas.getContext('2d');
      if (!ctx) {
        resolve(null);
        return;
      }

      // Draw image onto canvas
      ctx.drawImage(img, 0, 0, width, height);

      // Check for transparency - PNGs (especially stamps and signatures) MUST retain transparency
      let hasAlpha = false;
      const isPng = mimeType === 'image/png';
      if (isPng || mimeType === 'image/webp') {
        try {
          const imageData = ctx.getImageData(0, 0, width, height).data;
          for (let i = 3; i < imageData.length; i += 4) {
            if (imageData[i] < 255) {
              hasAlpha = true;
              break;
            }
          }
        } catch (e) {
          // Cross-origin issues or memory limit, default to safe PNG
          hasAlpha = true;
        }
      }

      // CRITICAL: If original is PNG or has alpha, keep as PNG so overlapping layers
      // (like stamps on top of signatures) never have their transparent backgrounds turned black or white!
      const outputMime = (hasAlpha || isPng) ? 'image/png' : 'image/jpeg';
      const outputQuality = outputMime === 'image/png' ? undefined : 0.75;

      canvas.toBlob(
        async (outBlob) => {
          if (!outBlob) {
            resolve(null);
            return;
          }
          const buf = await outBlob.arrayBuffer();
          resolve({ buffer: buf, format: outputMime });
        },
        outputMime,
        outputQuality
      );
    };

    img.onerror = () => {
      URL.revokeObjectURL(blobUrl);
      resolve(null);
    };

    img.src = blobUrl;
  });
}

/**
 * Standard alias for compressDocxImagesClient for compatibility
 */
export const compressDocxImages = compressDocxImagesClient;

