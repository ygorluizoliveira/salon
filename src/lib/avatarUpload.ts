import { supabase } from './supabase';

const MAX_FILE_SIZE_BYTES = 10 * 1024 * 1024;
const MAX_EDGE = 1024;

const AVATAR_BUCKET_CANDIDATES = Array.from(new Set([
  import.meta.env.VITE_SUPABASE_AVATAR_BUCKET,
  'avatars',
  'avatar',
  'profiles',
  'profile-images',
].filter(Boolean) as string[]));

function safeFileName(name: string): string {
  return name.replace(/[^a-zA-Z0-9._-]/g, '_');
}

async function preprocessAvatarFile(file: File): Promise<File> {
  if (file.size > MAX_FILE_SIZE_BYTES) {
    throw new Error('A imagem é muito grande. Use um arquivo de até 10MB.');
  }

  if (typeof window === 'undefined') {
    return file;
  }

  const imageUrl = URL.createObjectURL(file);

  try {
    const img = await new Promise<HTMLImageElement>((resolve, reject) => {
      const el = new Image();
      el.onload = () => resolve(el);
      el.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
      el.src = imageUrl;
    });

    const side = Math.min(img.naturalWidth, img.naturalHeight);
    const sx = Math.floor((img.naturalWidth - side) / 2);
    const sy = Math.floor((img.naturalHeight - side) / 2);
    const target = Math.min(MAX_EDGE, side);

    const canvas = document.createElement('canvas');
    canvas.width = target;
    canvas.height = target;

    const ctx = canvas.getContext('2d');
    if (!ctx) {
      return file;
    }

    ctx.drawImage(img, sx, sy, side, side, 0, 0, target, target);

    const blob = await new Promise<Blob | null>((resolve) => {
      canvas.toBlob((b) => resolve(b), 'image/jpeg', 0.86);
    });

    if (!blob) return file;

    return new File([blob], safeFileName((file.name || 'avatar').replace(/\.[^.]+$/, '') + '.jpg'), {
      type: 'image/jpeg',
      lastModified: Date.now(),
    });
  } finally {
    URL.revokeObjectURL(imageUrl);
  }
}

async function fileToDataUrl(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result === 'string') {
        resolve(result);
      } else {
        reject(new Error('Não foi possível converter a imagem para uso local.'));
      }
    };
    reader.onerror = () => reject(new Error('Não foi possível ler a imagem selecionada.'));
    reader.readAsDataURL(file);
  });
}

export async function uploadAvatarFile(file: File, folder: string): Promise<string> {
  const processed = await preprocessAvatarFile(file);
  const stamp = Date.now();
  const rand = Math.random().toString(36).slice(2, 8);
  const path = `${folder}/${stamp}_${rand}_${safeFileName(processed.name || 'avatar.jpg')}`;

  function isBucketMissing(message?: string) {
    const m = (message ?? '').toLowerCase();
    return m.includes('bucket not found') || m.includes('not found');
  }

  let lastError: string | null = null;
  let onlyBucketMissingErrors = true;

  for (const bucket of AVATAR_BUCKET_CANDIDATES) {
    const upload = await supabase.storage
      .from(bucket)
      .upload(path, processed, {
        upsert: true,
        cacheControl: '3600',
        contentType: processed.type || 'image/jpeg',
      });

    if (!upload.error) {
      const { data } = supabase.storage.from(bucket).getPublicUrl(path);
      if (!data?.publicUrl) {
        throw new Error('Não foi possível obter a URL pública da imagem.');
      }
      return data.publicUrl;
    }

    lastError = upload.error.message;
    onlyBucketMissingErrors = onlyBucketMissingErrors && isBucketMissing(upload.error.message);

    if (isBucketMissing(upload.error.message)) {
      // Tries to create the bucket when the current key has permission.
      await supabase.storage.createBucket(bucket, { public: true }).catch(() => undefined);
      const retry = await supabase.storage
        .from(bucket)
        .upload(path, processed, {
          upsert: true,
          cacheControl: '3600',
          contentType: processed.type || 'image/jpeg',
        });

      if (!retry.error) {
        const { data } = supabase.storage.from(bucket).getPublicUrl(path);
        if (!data?.publicUrl) {
          throw new Error('Não foi possível obter a URL pública da imagem.');
        }
        return data.publicUrl;
      }

      lastError = retry.error.message;
      onlyBucketMissingErrors = onlyBucketMissingErrors && isBucketMissing(retry.error.message);
      continue;
    }

    throw new Error(upload.error.message);
  }

  if (onlyBucketMissingErrors) {
    // Fallback sem bucket: mantém a foto funcional salvando como Data URL.
    return fileToDataUrl(processed);
  }

  throw new Error(`${lastError ?? 'Bucket não encontrado.'} Verifique os buckets ${AVATAR_BUCKET_CANDIDATES.join(', ')} ou defina VITE_SUPABASE_AVATAR_BUCKET.`);
}
