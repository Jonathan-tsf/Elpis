import { Amplify } from 'aws-amplify';

const userPoolId = process.env.NEXT_PUBLIC_COGNITO_USER_POOL_ID;
const userPoolClientId = process.env.NEXT_PUBLIC_COGNITO_CLIENT_ID;
const domain = process.env.NEXT_PUBLIC_COGNITO_DOMAIN;
const redirectUri = process.env.NEXT_PUBLIC_REDIRECT_URI;

let configured = false;

export function configureAmplify() {
  if (configured) return;
  if (!userPoolId || !userPoolClientId || !domain || !redirectUri) {
    console.warn(
      '[Amplify] Auth config env vars missing. Login will not work until .env.local is populated from CDK outputs.',
    );
    return;
  }
  Amplify.configure({
    Auth: {
      Cognito: {
        userPoolId,
        userPoolClientId,
        loginWith: {
          oauth: {
            domain,
            scopes: ['openid', 'email', 'profile'],
            redirectSignIn: [redirectUri],
            redirectSignOut: [redirectUri.replace('/auth/callback', '/')],
            responseType: 'code',
          },
        },
      },
    },
  });
  configured = true;
}
