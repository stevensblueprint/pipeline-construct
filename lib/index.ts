import { Construct } from "constructs";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import * as targets from "aws-cdk-lib/aws-events-targets";
import { DeploymentType, PipelineProps, WebhookConfig } from "./types";
import { ViteDeployment } from "./vite-deployment";

export class Pipeline extends Construct {
  private readonly pipeline: codepipeline.Pipeline;

  constructor(scope: Construct, id: string, props: PipelineProps) {
    super(scope, id);

    if (!props.name) {
      throw new Error("Pipeline name is required");
    }
    this.pipeline = this.createPipelineForType(props);

    if (props.webhook) {
      this.addWebhook(this.pipeline, props.webhook);
    }
  }

  private createPipelineForType(props: PipelineProps): codepipeline.Pipeline {
    switch (props.deploymentType) {
      case DeploymentType.ViteWebsite: {
        const deployment = new ViteDeployment(this, "ViteDeployment", {
          githubConfig: props.githubConfig,
          webhookConfig: props.webhook,
          vite: props.vite,
        });
        return deployment.provision(props.name);
      }

      default:
        throw new Error(`Unsupported deployment type: ${props.deploymentType}`);
    }
  }

  private addWebhook(pipeline: codepipeline.Pipeline, webhook: WebhookConfig) {
    const webhookLambda = new lambda.Function(this, "WebhookHandler", {
      runtime: lambda.Runtime.PYTHON_3_10,
      handler: "src.main.handler",
      code: lambda.Code.fromAsset(
        path.join(__dirname, "../functions/pipeline-lambda"),
        {
          bundling: {
            image: lambda.Runtime.PYTHON_3_10.bundlingImage,
            command: [
              "bash",
              "-c",
              "pip install -r src/requirements.txt -t /asset-output --platform manylinux2014_x86_64 --only-binary=:all: && cp -au . /asset-output",
            ],
          },
        },
      ),
      timeout: cdk.Duration.seconds(30),
      memorySize: 128,
      environment: {
        PIPELINE_NAME: pipeline.pipelineName,
        WEBHOOK_URL: webhook.url,
      },
      description:
        "Lambda function to send notifications on pipeline state changes",
    });

    pipeline.onStateChange("PipelineStateChange", {
      target: new targets.LambdaFunction(webhookLambda),
      description: "Lambda function to handle pipeline state changes",
    });
  }
}
