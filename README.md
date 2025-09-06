# Pipeline CDK Construct

A reusable [AWS CDK](https://docs.aws.amazon.com/cdk/) construct for creating CI/CD pipelines with optional webhook integrations.

## Features

- Define a complete **CodePipeline** with `Source`, `Build`, and `Deploy` stages.
- Supports multiple action types (GitHub, CodeBuild, S3, ECS, etc.).
- Optional **Webhook Lambda** integration to handle pipeline state change events.

## Installation

```bash
npm install @sitblueprint/pipeline-construct
```

## Usage

```typescript
import { Pipeline } from "pipeline-construct";
import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as codepipeline from "aws-cdk-lib/aws-codepipeline";
import * as codepipeline_actions from "aws-cdk-lib/aws-codepipeline-actions";
import * as codebuild from "aws-cdk-lib/aws-codebuild";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cdk from "aws-cdk-lib";

export class MyPipelineStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    const sourceOutput = new codepipeline.Artifact();
    const buildOutput = new codepipeline.Artifact();
    const myBucket = new s3.Bucket(this, "MyDeployBucket");

    new Pipeline(this, "MyPipeline", {
      name: "MyAppPipeline",
      sourceAction: new codepipeline_actions.GitHubSourceAction({...}),
      buildAction: new codepipeline_actions.CodeBuildAction({...}),
      deployAction: new codepipeline_actions.S3DeployAction({...}),
      webhook: {
        url: "https://my-webhook-endpoint.com/notify",
      },
    });
  }
}
```

## Development

- Build: `npm run build`
- Test: `npm test`

## License

MIT
