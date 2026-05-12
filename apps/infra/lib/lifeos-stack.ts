import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';
import { DataConstruct } from './constructs/data';

export interface LifeOsStackProps extends StackProps {
  envName: string;
}

export class LifeOsStack extends Stack {
  public readonly data: DataConstruct;

  constructor(scope: Construct, id: string, props: LifeOsStackProps) {
    super(scope, id, props);
    this.data = new DataConstruct(this, 'Data', { envName: props.envName });
  }
}
