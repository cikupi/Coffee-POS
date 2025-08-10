import jwt, { SignOptions } from 'jsonwebtoken';

const JWT_SECRET = process.env.JWT_SECRET || 'devsecret';
const JWT_EXPIRES_IN = process.env.JWT_EXPIRES_IN || '1d';

export type JwtPayload = {
  sub: string; // user id
  role: 'ADMIN' | 'KASIR' | 'BARISTA';
};

export function signAccessToken(payload: JwtPayload) {
  const options: SignOptions = { expiresIn: JWT_EXPIRES_IN as any };
  // Cast payload to object to satisfy jsonwebtoken v9 typings
  return jwt.sign(payload as unknown as Record<string, unknown>, JWT_SECRET, options);
}

export function verifyToken(token: string): JwtPayload {
  return jwt.verify(token, JWT_SECRET) as JwtPayload;
}
