# Pipeline CDK Construct

A reusable AWS CDK construct for building CI/CD pipelines.

## Features
- Easily integrate with AWS CodePipeline
- Supports multiple stages (source, build, deploy)
- Webhook integration

## Installation
```bash
npm install pipeline-construct
```

## Usage
```typescript
import { PipelineConstruct } from 'pipeline-construct';
import { Stack, StackProps } from 'aws-cdk-lib';
import { Construct } from 'constructs';

export class MyPipelineStack extends Stack {
	constructor(scope: Construct, id: string, props?: StackProps) {
		super(scope, id, props);

		new PipelineConstruct(this, 'MyPipeline', {
			// ...your pipeline configuration
		});
	}
}
```

## Development
- Build: `npm run build`
- Test: `npm test`

## License
MIT
