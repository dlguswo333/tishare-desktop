import fs from 'node:fs/promises';
import {TLSSocket} from 'node:tls';
import {BinaryLike, createHash, X509Certificate} from 'node:crypto';
import selfsigned from 'selfsigned';
import type {SafeStorage} from 'electron';

const CERT_ENCODING = 'base64' as const;

export const sha256Base64Url = (bytes: BinaryLike) => {
  return createHash('sha256').update(bytes).digest('base64url');
}

export const getCertFingerprintFromPem = (certPem: BinaryLike) => {
  // Fingerprint DER bytes, not PEM text.
  return sha256Base64Url(new X509Certificate(certPem).raw);
}

export const getPeerFingerprintFromSocket = (socket: TLSSocket) => {
  const peer = socket.getPeerCertificate(true);

  if (!peer?.raw) {
    throw new Error('no cert found');
  }

  return sha256Base64Url(peer.raw);
}

export const createCert = async () => {
  try {
    const oneYearInMs = 365 * 24 * 60 * 60 * 1000;

    const pems = await selfsigned.generate(
      [{ name: 'commonName', value: 'tiShare' }],
      {
        keyType: 'ec',
        curve: 'P-256',
        algorithm: 'sha256',
        notAfterDate: new Date(Date.now() + oneYearInMs),

        extensions: [
          { name: 'basicConstraints', cA: false },
          { name: 'keyUsage', digitalSignature: true, critical: true },
          { name: 'extKeyUsage', serverAuth: true, clientAuth: true },
        ],
      }
    );

    return {
      pems,
      cert: pems.cert,
      key: pems.private,
      fingerprint: getCertFingerprintFromPem(pems.cert),
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}

export const loadCert = async (path: string, safeStorage: SafeStorage) => {
  try {
    const loaded = JSON.parse(await fs.readFile(path, 'utf8'));

    return {
      cert: loaded.cert as string,
      key: safeStorage.decryptString(Buffer.from(loaded.encryptedKey, CERT_ENCODING)),
      fingerprint: getCertFingerprintFromPem(loaded.cert),
    };
  } catch (e) {
    console.error(e);
    return null;
  }
}

export const storeCert = async (pems: selfsigned.GenerateResult, path: string, safeStorage: SafeStorage) => {
  try {
    await fs.writeFile(
      path,
      JSON.stringify({
        cert: pems.cert,
        encryptedKey: safeStorage.encryptString(pems.private).toString(CERT_ENCODING),
      }),
    );
    return true;
  } catch (e) {
    console.error(e);
    return false;
  }
};
