import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataConstruct } from './constructs/data';
import { AuthConstruct } from './constructs/auth';

export interface LifeOsStackProps extends StackProps {
  envName: string;
  webBaseUrl: string;
}

export class LifeOsStack extends Stack {
  public readonly data: DataConstruct;
  public readonly auth: AuthConstruct;

  constructor(scope: Construct, id: string, props: LifeOsStackProps) {
    super(scope, id, props);
    this.data = new DataConstruct(this, 'Data', { envName: props.envName });
    this.auth = new AuthConstruct(this, 'Auth', {
      envName: props.envName,
      webCallbackUrls: [`${props.webBaseUrl}/auth/callback`, 'http://localhost:3000/auth/callback'],
      webLogoutUrls: [`${props.webBaseUrl}/`, 'http://localhost:3000/'],
    });
  }
}
