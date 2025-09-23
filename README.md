# Pipeline CDK Construct

A reusable [AWS CDK](https://docs.aws.amazon.com/cdk/) construct for creating specialized CI/CD pipelines with built-in deployment types and optional webhook integrations.

## Features

- **Multiple Deployment Types**: Currently supports Vite-based website deployments
- **Complete CI/CD Pipeline**: Automated `Source`, `Build`, and `Deploy` stages
- **GitHub Integration**: Built-in GitHub source action configuration
- **S3 + CloudFront Deployment**: Optimized for static website hosting
- **Optional Webhook Integration**: Lambda-based notifications for pipeline state changes
- **Environment Variables**: Support for custom build environment variables
- **CloudFront Invalidation**: Automatic cache invalidation after deployments

## Installation

```bash
npm install @sitblueprint/pipeline-construct
```

## Usage

### Vite Website Deployment

```typescript
import { Pipeline, DeploymentType } from "@sitblueprint/pipeline-construct";
import { Stack, StackProps } from "aws-cdk-lib";
import { Construct } from "constructs";
import * as s3 from "aws-cdk-lib/aws-s3";
import * as cloudfront from "aws-cdk-lib/aws-cloudfront";
import * as cdk from "aws-cdk-lib";

export class ViteWebsiteStack extends Stack {
  constructor(scope: Construct, id: string, props?: StackProps) {
    super(scope, id, props);

    // Create S3 bucket for website hosting
    const websiteBucket = new s3.Bucket(this, "WebsiteBucket", {
      websiteIndexDocument: "index.html",
      publicReadAccess: true,
      blockPublicAccess: s3.BlockPublicAccess.BLOCK_ACLS,
    });

    // Create CloudFront distribution
    const distribution = new cloudfront.CloudFrontWebDistribution(
      this,
      "Distribution",
      {
        originConfigs: [
          {
            s3OriginSource: {
              s3BucketSource: websiteBucket,
            },
            behaviors: [{ isDefaultBehavior: true }],
          },
        ],
      },
    );

    // Create the pipeline
    new Pipeline(this, "VitePipeline", {
      name: "MyViteWebsite",
      deploymentType: DeploymentType.ViteWebsite,
      githubConfig: {
        githubOwner: "your-github-username",
        githubRepo: "your-repo-name",
        githubOAuthToken: cdk.SecretValue.secretsManager("github-token"),
        githubBranch: "main", // optional, defaults to "main"
      },
      vite: {
        bucket: websiteBucket,
        distribution: distribution,
        buildCommands: ["npm run build"], // optional, defaults to ["npm run build"]
        env: {
          // optional build environment variables
          NODE_ENV: "production",
          API_URL: "https://api.example.com",
        },
      },
      webhook: {
        // optional
        url: "https://your-webhook-endpoint.com/notify",
      },
    });
  }
}
```

## Configuration Options

### DeploymentType

- `DeploymentType.ViteWebsite`: Deploys Vite-based applications to S3 with CloudFront

### ViteWebsiteConfig

- `bucket`: S3 bucket for hosting the built website
- `distribution`: CloudFront distribution for CDN
- `buildCommands?`: Custom build commands (defaults to `["npm run build"]`)
- `env?`: Environment variables for the build process

### GithubConfig

- `githubOwner`: GitHub repository owner/organization
- `githubRepo`: GitHub repository name
- `githubOAuthToken`: GitHub OAuth token (use `cdk.SecretValue`)
- `githubBranch?`: Branch to track (defaults to "main")

### WebhookConfig (Optional)

- `url`: Webhook endpoint URL for pipeline notifications

## Build Process

The Vite deployment automatically:

1. **Source Stage**: Pulls code from the specified GitHub repository
2. **Build Stage**:
   - Uses Node.js 20 runtime
   - Runs `npm ci` to install dependencies
   - Executes the specified build commands
   - Caches `node_modules` for faster subsequent builds
   - Outputs build artifacts from the `dist` directory
3. **Deploy Stage**:
   - Uploads built files to the S3 bucket
   - Automatically invalidates CloudFront cache

## Development

- Build: `npm run build`
- Test: `npm test`

## License

MIT
