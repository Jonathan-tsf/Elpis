import { Construct } from 'constructs';
import { Duration, CfnOutput, aws_iam as iam, aws_events as events, aws_events_targets as targets } from 'aws-cdk-lib';
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
      memorySize: 1024,
      timeout: Duration.seconds(60),
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

    // Transcribe permissions for voice journal pipeline
    this.fn.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ['transcribe:StartTranscriptionJob', 'transcribe:GetTranscriptionJob'],
        resources: ['*'],
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

    // EventBridge daily briefing cron — 06:00 UTC every day
    const briefingRule = new events.Rule(this, 'BriefingDailyRule', {
      ruleName: `lifeos-${props.envName}-briefing-daily`,
      schedule: events.Schedule.cron({ minute: '0', hour: '6', day: '*', month: '*', year: '*' }),
      description: 'Trigger daily morning briefing generation',
    });
    briefingRule.addTarget(
      new targets.LambdaFunction(this.fn, {
        event: events.RuleTargetInput.fromObject({
          source: 'eventbridge.cron',
          kind: 'briefing_daily',
        }),
      }),
    );
  }
}
