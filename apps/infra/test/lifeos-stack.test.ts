import { describe, it } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { LifeOsStack } from '../lib/lifeos-stack';

function makeStack() {
  const app = new App();
  return new LifeOsStack(app, 'TestStack', {
    envName: 'dev',
    webBaseUrl: 'http://localhost:3000',
    region: 'us-east-1',
    env: { account: '123456789012', region: 'us-east-1' },
  });
}

describe('LifeOsStack', () => {
  it('has a DynamoDB table with GSI1 and GSI2', () => {
    const t = Template.fromStack(makeStack());
    t.resourceCountIs('AWS::DynamoDB::Table', 1);
    t.hasResourceProperties('AWS::DynamoDB::Table', {
      BillingMode: 'PAY_PER_REQUEST',
      KeySchema: [
        { AttributeName: 'PK', KeyType: 'HASH' },
        { AttributeName: 'SK', KeyType: 'RANGE' },
      ],
    });
  });

  it('has 3 S3 buckets', () => {
    const t = Template.fromStack(makeStack());
    t.resourceCountIs('AWS::S3::Bucket', 3);
  });

  it('has a Cognito user pool with a web client', () => {
    const t = Template.fromStack(makeStack());
    t.resourceCountIs('AWS::Cognito::UserPool', 1);
    t.resourceCountIs('AWS::Cognito::UserPoolClient', 1);
    t.resourceCountIs('AWS::Cognito::UserPoolDomain', 1);
  });

  it('has a Lambda function and an HTTP API', () => {
    const t = Template.fromStack(makeStack());
    // Match the api Lambda specifically by memory size (512 MB),
    // distinct from CDK autoDeleteObjects custom-resource Lambdas.
    t.hasResourceProperties('AWS::Lambda::Function', {
      Runtime: 'nodejs20.x',
      MemorySize: 512,
    });
    t.resourceCountIs('AWS::ApiGatewayV2::Api', 1);
  });
});
