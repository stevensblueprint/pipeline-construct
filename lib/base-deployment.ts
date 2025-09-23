import { Construct } from "constructs";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import { DeploymentType, GithubConfig, WebhookConfig } from "./types";

export abstract class BaseDeployment extends Construct {
  readonly deploymentType: DeploymentType;
  readonly githubConfig: GithubConfig;
  readonly webhookConfig?: WebhookConfig;
  protected readonly sourceOutput = new codepipeline.Artifact("SourceOutput");
  protected readonly buildOutput = new codepipeline.Artifact("BuildOutput");

  protected sourceAction!: codepipeline_actions.Action;
  protected buildAction!: codepipeline_actions.Action;
  protected deployAction!: codepipeline_actions.Action;

  constructor(
    scope: Construct,
    id: string,
    props: {
      deploymentType: DeploymentType;
      githubConfig: GithubConfig;
      webhookConfig?: WebhookConfig;
    },
  ) {
    super(scope, id);
    this.deploymentType = props.deploymentType;
    this.githubConfig = props.githubConfig;
    this.webhookConfig = props.webhookConfig;
  }

  protected createSourceAction(): codepipeline_actions.GitHubSourceAction {
    return new codepipeline_actions.GitHubSourceAction({
      actionName: "GitHub_Source",
      owner: this.githubConfig.githubOwner,
      repo: this.githubConfig.githubRepo,
      branch: this.githubConfig.githubBranch ?? "main",
      oauthToken: this.githubConfig.githubOAuthToken,
      output: this.sourceOutput,
    });
  }

  protected abstract createBuildAction(): void;
  protected abstract createDeployAction(): void;

  protected createPipeline(pipelineName: string): codepipeline.Pipeline {
    this.sourceAction = this.createSourceAction();

    const pipeline = new codepipeline.Pipeline(
      this,
      `${pipelineName}Pipeline`,
      {
        pipelineName,
        stages: [
          {
            stageName: "Source",
            actions: [this.sourceAction],
          },
          {
            stageName: "Build",
            actions: [this.buildAction],
          },
          {
            stageName: "Deploy",
            actions: [this.deployAction],
          },
        ],
        restartExecutionOnUpdate: true,
      },
    );
    return pipeline;
  }

  public provision(pipelineName: string): codepipeline.Pipeline {
    if (!this.buildAction) this.createBuildAction();
    if (!this.deployAction) this.createDeployAction();
    return this.createPipeline(pipelineName);
  }
}
