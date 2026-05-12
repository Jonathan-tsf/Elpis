import type { MiddlewareHandler } from 'hono';
import { createRemoteJWKSet, jwtVerify } from 'jose';

export interface JwtVerifier {
  verify: (token: string) => Promise<{ sub: string } | null>;
}

export function makeCognitoVerifier(region: string, userPoolId: string): JwtVerifier {
  const jwks = createRemoteJWKSet(
    new URL(`https://cognito-idp.${region}.amazonaws.com/${userPoolId}/.well-known/jwks.json`),
  );
  return {
    async verify(token) {
      try {
        const { payload } = await jwtVerify(token, jwks, {
          issuer: `https://cognito-idp.${region}.amazonaws.com/${userPoolId}`,
        });
        if (typeof payload.sub !== 'string') return null;
        return { sub: payload.sub };
      } catch {
        return null;
      }
    },
  };
}

export function authMiddleware(verifier: JwtVerifier): MiddlewareHandler {
  return async (c, next) => {
    const header = c.req.header('Authorization');
    if (!header?.startsWith('Bearer ')) return c.json({ error: 'unauthorized' }, 401);
    const token = header.slice(7);
    const claims = await verifier.verify(token);
    if (!claims) return c.json({ error: 'unauthorized' }, 401);
    c.set('user', claims);
    await next();
  };
}
