import { Construct } from 'constructs';
import { aws_dynamodb as ddb, aws_s3 as s3, RemovalPolicy, Duration } from 'aws-cdk-lib';

export interface DataConstructProps {
  envName: string;
}

export class DataConstruct extends Construct {
  public readonly table: ddb.Table;
  public readonly photosBucket: s3.Bucket;
  public readonly voiceBucket: s3.Bucket;
  public readonly reportsBucket: s3.Bucket;

  constructor(scope: Construct, id: string, props: DataConstructProps) {
    super(scope, id);

    this.table = new ddb.Table(this, 'Table', {
      tableName: `lifeos-${props.envName}`,
      partitionKey: { name: 'PK', type: ddb.AttributeType.STRING },
      sortKey: { name: 'SK', type: ddb.AttributeType.STRING },
      billingMode: ddb.BillingMode.PAY_PER_REQUEST,
      pointInTimeRecoverySpecification: { pointInTimeRecoveryEnabled: true },
      removalPolicy: props.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI1',
      partitionKey: { name: 'gsi1pk', type: ddb.AttributeType.STRING },
      sortKey: { name: 'gsi1sk', type: ddb.AttributeType.STRING },
    });
    this.table.addGlobalSecondaryIndex({
      indexName: 'GSI2',
      partitionKey: { name: 'gsi2pk', type: ddb.AttributeType.STRING },
      sortKey: { name: 'gsi2sk', type: ddb.AttributeType.STRING },
    });

    const bucketBaseProps: s3.BucketProps = {
      encryption: s3.BucketEncryption.S3_MANAGED,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ALL,
      versioned: true,
      lifecycleRules: [{ abortIncompleteMultipartUploadAfter: Duration.days(7) }],
      removalPolicy: props.envName === 'prod' ? RemovalPolicy.RETAIN : RemovalPolicy.DESTROY,
      autoDeleteObjects: props.envName !== 'prod',
    };
    this.photosBucket = new s3.Bucket(this, 'PhotosBucket', {
      ...bucketBaseProps,
      bucketName: `lifeos-${props.envName}-photos-${this.node.addr.slice(0, 8)}`,
    });
    this.voiceBucket = new s3.Bucket(this, 'VoiceBucket', {
      ...bucketBaseProps,
      bucketName: `lifeos-${props.envName}-voice-${this.node.addr.slice(0, 8)}`,
    });
    this.reportsBucket = new s3.Bucket(this, 'ReportsBucket', {
      ...bucketBaseProps,
      bucketName: `lifeos-${props.envName}-reports-${this.node.addr.slice(0, 8)}`,
    });
  }
}
