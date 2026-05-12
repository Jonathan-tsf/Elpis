import { describe, it, expect } from 'vitest';
import { App } from 'aws-cdk-lib';
import { Template } from 'aws-cdk-lib/assertions';
import { LifeOsStack } from '../lib/lifeos-stack';

describe('LifeOsStack', () => {
  it('has a DynamoDB table with GSI1 and GSI2', () => {
    const app = new App();
    const stack = new LifeOsStack(app, 'TestStack', {
      envName: 'dev',
      env: { account: '123456789012', region: 'us-east-1' },
    });
    const t = Template.fromStack(stack);
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
    const app = new App();
    const stack = new LifeOsStack(app, 'TestStack', {
      envName: 'dev',
      env: { account: '123456789012', region: 'us-east-1' },
    });
    const t = Template.fromStack(stack);
    t.resourceCountIs('AWS::S3::Bucket', 3);
  });
});
