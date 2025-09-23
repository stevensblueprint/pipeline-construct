import * as cdk from "aws-cdk-lib";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";

export enum DeploymentType {
  ViteWebsite = "ViteWebsite",
}

export interface GithubConfig {
  githubOwner: string;
  githubRepo: string;
  githubOAuthToken: cdk.SecretValue;
  githubBranch?: string;
}

export interface WebhookConfig {
  /** Webhook URL */
  url: string;
}

/** Common props shared by all pipeline types */
interface PipelineCommon {
  /** Pipeline name */
  name: string;
  /** GitHub source config */
  githubConfig: GithubConfig;
  /** Optional webhook */
  webhook?: WebhookConfig;
}

export interface ViteWebsiteConfig {
  bucket: s3.IBucket;
  distribution: cloudfront.IDistribution;
  buildCommands?: string[];
  env?: Record<string, string>;
}

export type PipelineProps = PipelineCommon & {
  deploymentType: DeploymentType.ViteWebsite;
  vite: ViteWebsiteConfig;
};
