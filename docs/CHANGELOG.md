# Changelog

All notable changes to this project will be documented in this file.

The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/),  
and this project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.1.0] - 2025-09-07

### Added

- **Pipeline Construct** with `Source`, `Build`, and `Deploy` stages.
- Support for multiple action types:
  - GitHub source
  - CodeBuild
  - S3 / ECS deploy
- Optional **Webhook integration**:
  - Lambda function triggered on pipeline state changes.
  - Configurable webhook URL passed via environment variable.
- Bundled Python Lambda with dependency installation via `requirements.txt`.

### Changed

- N/A (initial release).

### Security

- Webhook Lambda uses environment variables for pipeline name and URL instead of hardcoding values.
- Bundling ensures dependencies are isolated in the Lambda asset output.
