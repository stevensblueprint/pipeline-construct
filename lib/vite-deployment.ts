import { Construct } from "constructs";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as iam from "aws-cdk-lib/aws-iam";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import { BaseDeployment } from "./base-deployment";
import {
  DeploymentType,
  GithubConfig,
  WebhookConfig,
  ViteWebsiteConfig,
} from "./types";

export class ViteDeployment extends BaseDeployment {
  private readonly bucket: s3.IBucket;
  private readonly distribution: cloudfront.IDistribution;
  private readonly buildCommands: string[];
  private readonly extraEnv?: Record<string, string>;

  constructor(
    scope: Construct,
    id: string,
    props: {
      githubConfig: GithubConfig;
      webhookConfig?: WebhookConfig;
      vite: ViteWebsiteConfig;
    },
  ) {
    super(scope, id, {
      deploymentType: DeploymentType.ViteWebsite,
      githubConfig: props.githubConfig,
      webhookConfig: props.webhookConfig,
    });

    this.bucket = props.vite.bucket;
    this.distribution = props.vite.distribution;
    this.buildCommands = props.vite.buildCommands ?? ["npm run build"];
    this.extraEnv = props.vite.env;
  }

  protected createBuildAction(): void {
    const envVars: Record<string, codebuild.BuildEnvironmentVariable> = {};
    for (const [k, v] of Object.entries(this.extraEnv ?? {})) {
      envVars[k] = { value: v };
    }

    const project = new codebuild.Project(this, "ViteBuildProject", {
      environment: {
        buildImage: codebuild.LinuxBuildImage.AMAZON_LINUX_2_5,
        privileged: false,
      },
      environmentVariables: envVars,
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          install: {
            "runtime-versions": { nodejs: "20" },
            commands: ["npm ci"],
          },
          build: {
            commands: ['echo "Building Vite app..."', ...this.buildCommands],
          },
        },
        artifacts: {
          "base-directory": "dist",
          files: ["**/*"],
        },
        cache: {
          paths: ["node_modules/**/*"],
        },
      }),
    });
    project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["cloudfront:CreateInvalidation"],
        resources: [this.distribution.distributionArn],
      }),
    );
    project.addToRolePolicy(
      new iam.PolicyStatement({
        actions: ["s3:PutObject", "s3:PutObjectAcl", "s3:ListBucket"],
        resources: [this.bucket.bucketArn, `${this.bucket.bucketArn}/*`],
      }),
    );

    this.buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "Vite_Build",
      project,
      input: this.sourceOutput,
      outputs: [this.buildOutput],
    });
  }

  protected createDeployAction(): void {
    this.deployAction = new codepipeline_actions.S3DeployAction({
      actionName: "S3_Deploy",
      bucket: this.bucket,
      input: this.buildOutput,
    });
  }

  protected override createPipeline(
    pipelineName: string,
  ): codepipeline.Pipeline {
    const pipeline = super.createPipeline(pipelineName);
    pipeline.node.addDependency(this.bucket as any, this.distribution as any);
    return pipeline;
  }
}
