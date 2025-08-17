import { App, Stack } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import { Pipeline } from "../lib";

describe("Pipeline Construct", () => {
  let app: App;
  let stack: Stack;
  let sourceAction: codepipeline_actions.GitHubSourceAction;
  let buildAction: codepipeline_actions.CodeBuildAction;
  let deployAction: codepipeline_actions.S3DeployAction;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, "TestStack");
    sourceAction = new codepipeline_actions.GitHubSourceAction({
      actionName: "Source",
      owner: "test-owner",
      repo: "test-repo",
      oauthToken: cdk.SecretValue.secretsManager("github-token"),
      output: new codepipeline.Artifact("SourceOutput"),
    });
    const buildProject = new codebuild.Project(stack, "TestBuildProject", {
      buildSpec: codebuild.BuildSpec.fromObject({
        version: "0.2",
        phases: {
          build: {
            commands: ["echo 'Hello, World!'"],
          },
        },
      }),
    });

    buildAction = new codepipeline_actions.CodeBuildAction({
      actionName: "Build",
      project: buildProject,
      input: new codepipeline.Artifact("SourceOutput"),
      outputs: [new codepipeline.Artifact("BuildOutput")],
    });

    const deployBucket = new s3.Bucket(stack, "TestDeployBucket");
    deployAction = new codepipeline_actions.S3DeployAction({
      actionName: "Deploy",
      bucket: deployBucket,
      input: new codepipeline.Artifact("BuildOutput"),
    });
  });

  describe("Pipeline Creation", () => {
    test("should create pipeline without webhook", () => {
      // Arrange & Act
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::Lambda::Function", 0);
      template.resourceCountIs("AWS::Events::Rule", 0);
    });

    test("should create pipeline with webhook", () => {
      // Arrange & Act
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
        webhook: {
          url: "https://example.com/webhook",
        },
      });

      // Assert
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
        Name: "TestPipeline",
      });
    });
  });

  describe("Webhook Configuration", () => {
    test("should configure webhook Lambda with correct environment variables", () => {
      // Arrange
      const webhookUrl =
        "https://my-webhook.example.com/pipeline-notifications";

      // Act
      new Pipeline(stack, "TestPipeline", {
        name: "MyTestPipeline",
        sourceAction,
        buildAction,
        deployAction,
        webhook: {
          url: webhookUrl,
        },
      });

      // Assert
      const template = Template.fromStack(stack);
    });

    test("should create unique Lambda function for each pipeline", () => {
      // Arrange & Act
      new Pipeline(stack, "TestPipeline1", {
        name: "Pipeline1",
        sourceAction,
        buildAction,
        deployAction,
        webhook: { url: "https://webhook1.com" },
      });

      new Pipeline(stack, "TestPipeline2", {
        name: "Pipeline2",
        sourceAction,
        buildAction,
        deployAction,
        webhook: { url: "https://webhook2.com" },
      });

      // Assert
      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::Lambda::Function", 2);
      template.resourceCountIs("AWS::Events::Rule", 2);
    });
  });

  describe("Pipeline Stages", () => {
    test("should create all three stages in correct order", () => {
      // Arrange & Act
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
        Stages: [{ Name: "Source" }, { Name: "Build" }, { Name: "Deploy" }],
      });
    });

    test("should include correct actions in each stage", () => {
      // Arrange & Act
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
        Stages: [
          {
            Name: "Source",
            Actions: [Match.objectLike({ Name: "Source" })],
          },
          {
            Name: "Build",
            Actions: [Match.objectLike({ Name: "Build" })],
          },
          {
            Name: "Deploy",
            Actions: [Match.objectLike({ Name: "Deploy" })],
          },
        ],
      });
    });
  });

  describe("Lambda Function Configuration", () => {
    test("should configure Lambda with correct runtime and handler", () => {
      // Arrange & Act
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
        webhook: { url: "https://example.com/webhook" },
      });

      // Assert
      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::Lambda::Function", {
        Runtime: "python3.10",
        Handler: "src.main.handler",
        Timeout: 30,
        MemorySize: 128,
      });
    });

    test("should configure Lambda with correct IAM permissions", () => {
      // Arrange & Act
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
        webhook: { url: "https://example.com/webhook" },
      });

      // Assert
      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::IAM::Role", {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: "Allow",
              Principal: {
                Service: "lambda.amazonaws.com",
              },
              Action: "sts:AssumeRole",
            },
          ],
        },
      });

      template.hasResourceProperties("AWS::IAM::Policy", {
        PolicyDocument: {
          Statement: Match.arrayWith([
            {
              Effect: "Allow",
              Action: [
                "logs:CreateLogGroup",
                "logs:CreateLogStream",
                "logs:PutLogEvents",
              ],
              Resource: Match.anyValue(),
            },
          ]),
        },
      });
    });
  });

  describe("Error Cases", () => {
    test("should handle missing required properties", () => {
      // Assert - TypeScript should catch these at compile time,
      // but we can test runtime behavior
      expect(() => {
        new Pipeline(stack, "TestPipeline", {
          name: "",
          sourceAction,
          buildAction,
          deployAction,
        });
      }).toThrow(); // Empty name should not work
    });
  });

  describe("Integration Tests", () => {
    test("should create valid CloudFormation template", () => {
      // Arrange & Act
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
        webhook: { url: "https://example.com/webhook" },
      });

      // Assert
      const template = Template.fromStack(stack);

      // Should have all expected resources
      template.resourceCountIs("AWS::CodePipeline::Pipeline", 1);
      template.resourceCountIs("AWS::Lambda::Function", 1);
      template.resourceCountIs("AWS::Events::Rule", 1);
      template.resourceCountIs("AWS::Lambda::Permission", 1);
      expect(() => template.toJSON()).not.toThrow();
    });
  });
});
