#!/usr/bin/env tsx
import { App } from 'aws-cdk-lib';
import { LifeOsStack } from '../lib/lifeos-stack';
import { loadStackConfig } from '../lib/config';

const app = new App();
const cfg = loadStackConfig();
new LifeOsStack(app, `LifeOs-${cfg.envName}`, {
  envName: cfg.envName,
  env: { account: cfg.account, region: cfg.region },
});
