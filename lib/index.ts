import { Construct } from "constructs";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as lambda from "aws-cdk-lib/aws-lambda";
import * as cdk from "aws-cdk-lib";
import * as path from "path";
import * as targets from "aws-cdk-lib/aws-events-targets";
export interface WebhookConfig {
  /**
   * Webhook URL
   */
  url: string;
}

export interface PipelineProps {
  /**
   * Pipeline name
   */
  name: string;
  /**
   * Action that retrieves the source code
   */
  sourceAction: codepipeline_actions.GitHubSourceAction;
  /**
   * Action that builds the source code
   */
  buildAction: codepipeline_actions.CodeBuildAction;
  /**
   * Action that deploys the code to either S3 or ECS
   */
  deployAction: codepipeline_actions.Action;
  /**
   * Webhook configuration
   */
  webhook?: WebhookConfig;
}

export class Pipeline extends Construct {
  private readonly pipeline: codepipeline.Pipeline;
  constructor(scope: Construct, id: string, props: PipelineProps) {
    super(scope, id);
    const stages: codepipeline.StageProps[] = [
      { stageName: "Source", actions: [props.sourceAction] },
      { stageName: "Build", actions: [props.buildAction] },
      { stageName: "Deploy", actions: [props.deployAction] },
    ];
    this.pipeline = new codepipeline.Pipeline(this, props.name, {
      pipelineName: props.name,
      stages: stages,
    });

    if (props.webhook) {
      this._addWebhook(this.pipeline, props.webhook);
    }
  }

  private _addWebhook(
    pipeline: codepipeline.Pipeline,
    webhook: WebhookConfig,
  ): void {
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
