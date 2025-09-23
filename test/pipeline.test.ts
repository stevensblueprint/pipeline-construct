import { App, Stack, SecretValue } from "aws-cdk-lib";
import { Template, Match } from "aws-cdk-lib/assertions";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as origins from "aws-cdk-lib/aws-cloudfront-origins";

import { Pipeline } from "../lib";
import {
  DeploymentType,
  GithubConfig,
  WebhookConfig,
  ViteWebsiteConfig,
} from "../lib/types";

function sanitizeTemplate(json: any) {
  const clone = JSON.parse(JSON.stringify(json));
  if (clone.Metadata) delete clone.Metadata;
  for (const [_, res] of Object.entries<any>(clone.Resources ?? {})) {
    if (res.Type === "AWS::Lambda::Function" && res.Properties) {
      if (res.Properties.Code?.S3Key)
        res.Properties.Code.S3Key = "<S3Key:elided>";
      if (typeof res.Properties.Role === "string")
        res.Properties.Role = "<LambdaRoleArn>";
      if (res.Properties.Environment?.Variables) {
        for (const k of Object.keys(res.Properties.Environment.Variables)) {
          if (/TOKEN|SECRET|KEY/i.test(k)) {
            res.Properties.Environment.Variables[k] = "<redacted>";
          }
        }
      }
    }
    if (res.Type === "AWS::IAM::Role" && res.Properties?.RoleName) {
      res.Properties.RoleName = "<RoleName>";
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

describe("Pipeline (ViteWebsite) Construct", () => {
  let app: App;
  let stack: Stack;

  let bucket: s3.Bucket;
  let distribution: cloudfront.Distribution;
  let vite: ViteWebsiteConfig;
  let githubConfig: GithubConfig;

  beforeEach(() => {
    app = new App();
    stack = new Stack(app, "TestStack");

    bucket = new s3.Bucket(stack, "SiteBucket");
    distribution = new cloudfront.Distribution(stack, "Cdn", {
      defaultBehavior: { origin: new origins.S3Origin(bucket) },
    });

    vite = {
      bucket,
      distribution,
      buildCommands: ["npm ci", "npm run build"],
      env: { VITE_MODE: "test" },
    };

    githubConfig = {
      githubOwner: "test-owner",
      githubRepo: "test-repo",
      githubOAuthToken: SecretValue.secretsManager("github-token"),
      githubBranch: "main",
    };
  });

  const make = (
    id: string,
    opts?: { webhook?: WebhookConfig; name?: string },
  ) =>
    new Pipeline(stack, id, {
      name: opts?.name ?? "TestPipeline",
      deploymentType: DeploymentType.ViteWebsite,
      githubConfig,
      vite,
      webhook: opts?.webhook,
    });

  describe("Creation", () => {
    test("creates a Vite pipeline without webhook", () => {
      make("P");
      const template = Template.fromStack(stack);
      template.resourceCountIs("AWS::CodePipeline::Pipeline", 1);
      template.resourceCountIs("AWS::Lambda::Function", 0);
      template.resourceCountIs("AWS::Events::Rule", 0);
      template.hasResourceProperties("AWS::CodePipeline::Pipeline", {
        Name: "TestPipeline",
        Stages: [
          {
            Name: "Source",
            Actions: [Match.objectLike({ Name: "GitHub_Source" })],
          },
          {
            Name: "Build",
            Actions: [Match.objectLike({ Name: "Vite_Build" })],
          },
          {
            Name: "Deploy",
            Actions: [Match.objectLike({ Name: "S3_Deploy" })],
          },
        ],
        RestartExecutionOnUpdate: true,
      });

      expect(sanitizeTemplate(template.toJSON())).toMatchSnapshot();
    });

    test("throws on missing name", () => {
      expect(
        () =>
          new Pipeline(stack, "Bad", {
            name: "",
            deploymentType: DeploymentType.ViteWebsite,
            githubConfig,
            vite,
          }),
      ).toThrow();
    });
  });

  describe("Stages order & names", () => {
    test("Source → Build → Deploy with expected action names", () => {
      make("P");

      const template = Template.fromStack(stack);
      const pipelines = template.findResources("AWS::CodePipeline::Pipeline");
      const first = Object.values<any>(pipelines)[0];

      const stageNames = first.Properties.Stages.map((s: any) => s.Name);
      expect(stageNames).toEqual(["Source", "Build", "Deploy"]);

      const actions = first.Properties.Stages.map((s: any) => ({
        name: s.Name,
        actionNames: (s.Actions ?? []).map((a: any) => a.Name),
      }));
      expect(actions).toEqual([
        { name: "Source", actionNames: ["GitHub_Source"] },
        { name: "Build", actionNames: ["Vite_Build"] },
        { name: "Deploy", actionNames: ["S3_Deploy"] },
      ]);
    });
  });

  describe("Integration", () => {
    test("synthesizes a valid template with webhook wiring", () => {
      make("P", { webhook: { url: "https://example.com/webhook" } });

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
