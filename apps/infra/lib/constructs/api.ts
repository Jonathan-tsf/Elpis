import { Construct } from 'constructs';
import { Duration, CfnOutput, aws_iam as iam } from 'aws-cdk-lib';
import { aws_lambda as lambda } from 'aws-cdk-lib';
import {
  HttpApi,
  HttpMethod,
  CorsHttpMethod,
} from 'aws-cdk-lib/aws-apigatewayv2';
import { HttpLambdaIntegration } from 'aws-cdk-lib/aws-apigatewayv2-integrations';
import { aws_dynamodb as ddb, aws_s3 as s3 } from 'aws-cdk-lib';
import * as path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

export interface ApiConstructProps {
  envName: string;
  region: string;
  table: ddb.ITable;
  buckets: { photos: s3.IBucket; voice: s3.IBucket; reports: s3.IBucket };
  cognitoUserPoolId: string;
  cognitoClientId: string;
}

export class ApiConstruct extends Construct {
  public readonly httpApi: HttpApi;
  public readonly fn: lambda.Function;

  constructor(scope: Construct, id: string, props: ApiConstructProps) {
    super(scope, id);

    this.fn = new lambda.Function(this, 'Fn', {
      functionName: `lifeos-${props.envName}-api`,
      runtime: lambda.Runtime.NODEJS_20_X,
      handler: 'lambda.handler',
      code: lambda.Code.fromAsset(path.join(__dirname, '../../../api/dist')),
      memorySize: 512,
      timeout: Duration.seconds(15),
      environment: {
        TABLE_NAME: props.table.tableName,
        PHOTOS_BUCKET: props.buckets.photos.bucketName,
        VOICE_BUCKET: props.buckets.voice.bucketName,
        REPORTS_BUCKET: props.buckets.reports.bucketName,
        COGNITO_USER_POOL_ID: props.cognitoUserPoolId,
        COGNITO_CLIENT_ID: props.cognitoClientId,
        VERSION: process.env['GIT_SHA'] ?? 'dev',
      },
    });
    props.table.grantReadWriteData(this.fn);
    props.buckets.photos.grantReadWrite(this.fn);
    props.buckets.voice.grantReadWrite(this.fn);
    props.buckets.reports.grantReadWrite(this.fn);

    // Bedrock permissions for Claude inference (foundation models + cross-region inference profiles)
    this.fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['bedrock:InvokeModel', 'bedrock:InvokeModelWithResponseStream'],
        resources: [
          `arn:aws:bedrock:us-east-1::foundation-model/anthropic.claude-*`,
          `arn:aws:bedrock:us-east-1:*:inference-profile/us.anthropic.claude-*`,
          `arn:aws:bedrock:us-*-1::foundation-model/anthropic.claude-*`,
        ],
      }),
    );

    this.httpApi = new HttpApi(this, 'HttpApi', {
      apiName: `lifeos-${props.envName}`,
      corsPreflight: {
        allowOrigins: ['http://localhost:3000', 'http://localhost:3002'],
        allowMethods: [CorsHttpMethod.ANY],
        allowHeaders: ['Authorization', 'Content-Type'],
      },
    });

    const integration = new HttpLambdaIntegration('LambdaIntegration', this.fn);
    // Exclude OPTIONS — API Gateway handles CORS preflight itself when the
    // method is not registered as a route. Registering ANY would forward
    // OPTIONS to the Lambda, which then 401s in our auth middleware.
    const appMethods = [
      HttpMethod.GET,
      HttpMethod.POST,
      HttpMethod.PUT,
      HttpMethod.PATCH,
      HttpMethod.DELETE,
      HttpMethod.HEAD,
    ];
    this.httpApi.addRoutes({ path: '/{proxy+}', methods: appMethods, integration });
    this.httpApi.addRoutes({ path: '/', methods: appMethods, integration });

    new CfnOutput(this, 'ApiUrl', { value: this.httpApi.apiEndpoint });
  }
}
