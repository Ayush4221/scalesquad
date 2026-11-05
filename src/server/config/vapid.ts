import { createECDH, timingSafeEqual } from 'node:crypto';
export function validVapid(publicKey: string, privateKey: string, subject: string): boolean {
  try {
    if (!/^[\w-]{87}$/.test(publicKey) || !/^[\w-]{43}$/.test(privateKey)) return false;
    const contact = new URL(subject);
    if (contact.protocol === 'mailto:') {
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(contact.pathname) || contact.search || contact.hash)
        return false;
    } else if (
      contact.protocol !== 'https:' ||
      contact.username ||
      contact.password ||
      contact.hostname === 'localhost'
    )
      return false;
    const curve = createECDH('prime256v1');
    curve.setPrivateKey(Buffer.from(privateKey, 'base64url'));
    const expected = curve.getPublicKey(),
      provided = Buffer.from(publicKey, 'base64url');
    return expected.length === provided.length && timingSafeEqual(expected, provided);
  } catch {
    return false;
  }
}
