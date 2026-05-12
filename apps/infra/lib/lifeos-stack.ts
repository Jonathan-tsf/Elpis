import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataConstruct } from './constructs/data';
import { AuthConstruct } from './constructs/auth';
import { ApiConstruct } from './constructs/api';

export interface LifeOsStackProps extends StackProps {
  envName: string;
  webBaseUrl: string;
  region: string;
}

export class LifeOsStack extends Stack {
  public readonly data: DataConstruct;
  public readonly auth: AuthConstruct;
  public readonly api: ApiConstruct;

  constructor(scope: Construct, id: string, props: LifeOsStackProps) {
    super(scope, id, props);

    this.data = new DataConstruct(this, 'Data', { envName: props.envName });
    this.auth = new AuthConstruct(this, 'Auth', {
      envName: props.envName,
      webCallbackUrls: [
        `${props.webBaseUrl}/auth/callback`,
        'http://localhost:3000/auth/callback',
        'http://localhost:3002/auth/callback',
      ],
      webLogoutUrls: [
        `${props.webBaseUrl}/`,
        'http://localhost:3000/',
        'http://localhost:3002/',
      ],
    });
    this.api = new ApiConstruct(this, 'Api', {
      envName: props.envName,
      region: props.region,
      table: this.data.table,
      buckets: {
        photos: this.data.photosBucket,
        voice: this.data.voiceBucket,
        reports: this.data.reportsBucket,
      },
      cognitoUserPoolId: this.auth.userPool.userPoolId,
      cognitoClientId: this.auth.userPoolClient.userPoolClientId,
    });
  }
}
