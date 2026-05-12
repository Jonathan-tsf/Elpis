export interface StackConfig {
  envName: 'dev' | 'prod';
  region: string;
  account: string;
}

export function loadStackConfig(): StackConfig {
  const account = process.env.CDK_DEFAULT_ACCOUNT;
  const region = process.env.CDK_DEFAULT_REGION ?? 'us-east-1';
  const envName = (process.env.ENV_NAME ?? 'dev') as 'dev' | 'prod';
  if (!account) throw new Error('CDK_DEFAULT_ACCOUNT is required');
  return { envName, region, account };
}
