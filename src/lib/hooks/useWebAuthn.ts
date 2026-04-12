import { supabase } from '../supabase';

// ── Helpers ───────────────────────────────────────────────────────────────────
function bufferToBase64(buf: ArrayBuffer): string {
  return btoa(String.fromCharCode(...new Uint8Array(buf)));
}
function base64ToBuffer(b64: string): ArrayBuffer {
  const bin = atob(b64);
  const buf = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) buf[i] = bin.charCodeAt(i);
  return buf.buffer;
}

export const webAuthnSupported =
  typeof window !== 'undefined' && !!window.PublicKeyCredential;

// ── Register a passkey for a client ──────────────────────────────────────────
export async function registerPasskey(clientId: string, clientName: string): Promise<void> {
  if (!webAuthnSupported) throw new Error('WebAuthn não suportado neste dispositivo.');

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  const credential = await navigator.credentials.create({
    publicKey: {
      challenge,
      rp: { name: 'Rose Coiffeur' },
      user: {
        id: new TextEncoder().encode(clientId),
        name: clientName,
        displayName: clientName,
      },
      pubKeyCredParams: [{ alg: -7, type: 'public-key' }],
      authenticatorSelection: {
        authenticatorAttachment: 'platform',
        userVerification: 'required',
      },
      timeout: 60000,
      attestation: 'none',
    },
  }) as PublicKeyCredential | null;

  if (!credential) throw new Error('Registro cancelado.');

  const response = credential.response as AuthenticatorAttestationResponse;
  const credentialId = bufferToBase64(credential.rawId);
  const publicKey    = bufferToBase64(response.getPublicKey()!);

  const { error } = await supabase.from('client_passkeys').upsert({
    client_id:     clientId,
    credential_id: credentialId,
    public_key:    publicKey,
  }, { onConflict: 'credential_id' });

  if (error) throw new Error(error.message);
}

// ── Authenticate with passkey ─────────────────────────────────────────────────
export async function authenticateWithPasskey(clientId: string): Promise<boolean> {
  if (!webAuthnSupported) return false;

  // Fetch stored credential IDs for this client
  const { data: keys } = await supabase
    .from('client_passkeys')
    .select('credential_id')
    .eq('client_id', clientId);

  if (!keys?.length) return false;

  const challenge = crypto.getRandomValues(new Uint8Array(32));

  try {
    const assertion = await navigator.credentials.get({
      publicKey: {
        challenge,
        allowCredentials: keys.map(k => ({
          id: base64ToBuffer(k.credential_id),
          type: 'public-key' as const,
        })),
        userVerification: 'required',
        timeout: 60000,
      },
    }) as PublicKeyCredential | null;

    return !!assertion;
  } catch {
    return false;
  }
}
