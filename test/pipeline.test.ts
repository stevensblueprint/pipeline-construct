// pipeline.test.ts
import { App, Stack } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";
import { Pipeline } from "../lib";

function sanitizeTemplate(json: any) {
  const clone = JSON.parse(JSON.stringify(json));
  if (clone.Metadata) delete clone.Metadata;
  for (const [id, res] of Object.entries<any>(clone.Resources ?? {})) {
    if (res.Type === "AWS::Lambda::Function" && res.Properties) {
      if (res.Properties.Code?.S3Key) {
        res.Properties.Code.S3Key = "<S3Key:elided>";
      }
      if (res.Properties.Role && typeof res.Properties.Role === "string") {
        res.Properties.Role = "<LambdaRoleArn>";
      }
      if (res.Properties.Environment?.Variables) {
        for (const k of Object.keys(res.Properties.Environment.Variables)) {
          if (/TOKEN|SECRET|KEY/i.test(k)) {
            res.Properties.Environment.Variables[k] = "<redacted>";
          }
        }
      }
    }
    if (res.Type === "AWS::IAM::Role" && res.Properties) {
      if (res.Properties.RoleName) res.Properties.RoleName = "<RoleName>";
    }
    if (res.Type === "AWS::Events::Rule" && res.Properties?.Name) {
      res.Properties.Name = "<RuleName>";
    }
    if (res.Type === "AWS::S3::Bucket" && res.Properties?.BucketName) {
      res.Properties.BucketName = "<BucketName>";
    }
  }
  if (clone.Parameters) clone.Parameters = "<Parameters elided>";
  if (clone.Outputs) clone.Outputs = "<Outputs elided>";

  return clone;
}

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
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::Lambda::Function", 0);
      template.resourceCountIs("AWS::Events::Rule", 0);
      expect(sanitizeTemplate(template.toJSON())).toMatchSnapshot();
    });

    test("should create pipeline with webhook", () => {
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
        webhook: { url: "https://example.com/webhook" },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
        Name: "TestPipeline",
      });
      expect(sanitizeTemplate(template.toJSON())).toMatchSnapshot();
    });
  });

  describe("Webhook Configuration", () => {
    test("should configure webhook Lambda with correct environment variables", () => {
      const webhookUrl =
        "https://my-webhook.example.com/pipeline-notifications";

      new Pipeline(stack, "TestPipeline", {
        name: "MyTestPipeline",
        sourceAction,
        buildAction,
        deployAction,
        webhook: { url: webhookUrl },
      });

      const template = Template.fromStack(stack);
      const lambdas = template.findResources("AWS::Lambda::Function");
      expect(sanitizeTemplate(lambdas)).toMatchSnapshot();
    });

    test("should create unique Lambda function for each pipeline", () => {
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

      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::Lambda::Function", 2);
      template.resourceCountIs("AWS::Events::Rule", 2);
      const rules = template.findResources("AWS::Events::Rule");
      expect(sanitizeTemplate(rules)).toMatchSnapshot();
    });
  });

  describe("Pipeline Stages", () => {
    test("should create all three stages in correct order", () => {
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
        Stages: [{ Name: "Source" }, { Name: "Build" }, { Name: "Deploy" }],
      });
      const pipelines = template.findResources("AWS::CodePipeline::Pipeline");
      const first = Object.values<any>(pipelines)[0];
      expect(first.Properties.Stages.map((s: any) => s.Name))
        .toMatchInlineSnapshot(`
          [
            "Source",
            "Build",
            "Deploy",
          ]
        `);
    });

    test("should include correct actions in each stage", () => {
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
        Stages: [
          { Name: "Source", Actions: [Match.objectLike({ Name: "Source" })] },
          { Name: "Build", Actions: [Match.objectLike({ Name: "Build" })] },
          { Name: "Deploy", Actions: [Match.objectLike({ Name: "Deploy" })] },
        ],
      });

      const pipelines = template.findResources("AWS::CodePipeline::Pipeline");
      const first = Object.values<any>(pipelines)[0];
      const actions = first.Properties.Stages.map((s: any) => ({
        name: s.Name,
        actionNames: (s.Actions ?? []).map((a: any) => a.Name),
      }));
      expect(actions).toMatchInlineSnapshot(`
        [
          {
            "actionNames": [
              "Source",
            ],
            "name": "Source",
          },
          {
            "actionNames": [
              "Build",
            ],
            "name": "Build",
          },
          {
            "actionNames": [
              "Deploy",
            ],
            "name": "Deploy",
          },
        ]
      `);
    });
  });

  describe("Lambda Function Configuration", () => {
    test("should configure Lambda with correct runtime and handler", () => {
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
        webhook: { url: "https://example.com/webhook" },
      });

      const template = Template.fromStack(stack);
      template.hasResourceProperties("AWS::Lambda::Function", {
        Runtime: "python3.10",
        Handler: "src.main.handler",
        Timeout: 30,
        MemorySize: 128,
      });

      const lambdas = template.findResources("AWS::Lambda::Function");
      expect(sanitizeTemplate(lambdas)).toMatchSnapshot();
    });

    test("should configure Lambda with correct IAM permissions", () => {
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
        webhook: { url: "https://example.com/webhook" },
      });

      const template = Template.fromStack(stack);

      template.hasResourceProperties("AWS::IAM::Role", {
        AssumeRolePolicyDocument: {
          Statement: [
            {
              Effect: "Allow",
              Principal: { Service: "lambda.amazonaws.com" },
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
      const roles = template.findResources("AWS::IAM::Role");
      const policies = template.findResources("AWS::IAM::Policy");
      expect(sanitizeTemplate({ roles, policies })).toMatchSnapshot();
    });
  });

  describe("Error Cases", () => {
    test("should handle missing required properties", () => {
      expect(() => {
        new Pipeline(stack, "TestPipeline", {
          name: "",
          sourceAction,
          buildAction,
          deployAction,
        });
      }).toThrow();
    });
  });

  describe("Integration Tests", () => {
    test("should create valid CloudFormation template", () => {
      new Pipeline(stack, "TestPipeline", {
        name: "TestPipeline",
        sourceAction,
        buildAction,
        deployAction,
        webhook: { url: "https://example.com/webhook" },
      });

      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::CodePipeline::Pipeline", 1);
      template.resourceCountIs("AWS::Lambda::Function", 1);
      template.resourceCountIs("AWS::Events::Rule", 1);
      template.resourceCountIs("AWS::Lambda::Permission", 1);
      expect(() => template.toJSON()).not.toThrow();
      expect(sanitizeTemplate(template.toJSON())).toMatchSnapshot();
    });
  });
});
