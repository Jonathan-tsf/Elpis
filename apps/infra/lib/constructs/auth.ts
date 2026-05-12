import { Construct } from 'constructs';
import { aws_cognito as cognito, RemovalPolicy, CfnOutput } from 'aws-cdk-lib';

export interface AuthConstructProps {
  envName: string;
  webCallbackUrls: string[];
  webLogoutUrls: string[];
}

export class AuthConstruct extends Construct {
  public readonly userPool: cognito.UserPool;
  public readonly userPoolClient: cognito.UserPoolClient;
  public readonly userPoolDomain: cognito.UserPoolDomain;

  constructor(scope: Construct, id: string, props: AuthConstructProps) {
    super(scope, id);

    this.userPool = new cognito.UserPool(this, 'UserPool', {
      userPoolName: `lifeos-${props.envName}`,
      selfSignUpEnabled: true,
      signInAliases: { email: true },
      autoVerify: { email: true },
      standardAttributes: { email: { required: true, mutable: false } },
      passwordPolicy: {
        minLength: 12,
        requireLowercase: true,
        requireUppercase: true,
        requireDigits: true,
        requireSymbols: false,
      },
      accountRecovery: cognito.AccountRecovery.EMAIL_ONLY,
      removalPolicy: props.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });

    this.userPoolClient = this.userPool.addClient('WebClient', {
      userPoolClientName: 'web',
      authFlows: { userSrp: true },
      oAuth: {
        flows: { authorizationCodeGrant: true },
        scopes: [cognito.OAuthScope.OPENID, cognito.OAuthScope.EMAIL, cognito.OAuthScope.PROFILE],
        callbackUrls: props.webCallbackUrls,
        logoutUrls: props.webLogoutUrls,
      },
      preventUserExistenceErrors: true,
    });

    this.userPoolDomain = this.userPool.addDomain('Domain', {
      cognitoDomain: { domainPrefix: `lifeos-${props.envName}-${this.node.addr.slice(0, 8)}` },
    });

    new CfnOutput(this, 'UserPoolId', { value: this.userPool.userPoolId });
    new CfnOutput(this, 'UserPoolClientId', { value: this.userPoolClient.userPoolClientId });
    new CfnOutput(this, 'UserPoolDomain', {
      value: `${this.userPoolDomain.domainName}.auth.${this.node.tryGetContext('region') ?? 'us-east-1'}.amazoncognito.com`,
    });
  }
}
