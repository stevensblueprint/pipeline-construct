# Changelog

All notable changes to this project will be documented in this file.  
The format is based on [Keep a Changelog](https://keepachangelog.com/en/1.0.0/) and the project adheres to [Semantic Versioning](https://semver.org/spec/v2.0.0.html).

---

## [v0.2.0] - 2025-09-23

### Added

- **Typed deployment model**
  - `DeploymentType` enum and strongly-typed `PipelineProps` in `lib/types.ts`.
  - `BaseDeployment` abstract class factoring common pipeline wiring (source/build/deploy artifacts & actions).
- **Vite website pipeline**
  - `ViteDeployment` with:
    - GitHub source (`GitHub_Source`).
    - CodeBuild step (`Vite_Build`) with Node 20, cache of `node_modules`, optional `buildCommands`, and extra `env`.
    - S3 deploy (`S3_Deploy`) to a provided bucket.
    - CloudFront invalidation permission (least privilege) for a provided distribution.
- **Webhook integration** (optional)
  - Webhook Lambda + EventBridge rule per pipeline.
  - CodePipeline GitHub Webhook resource registered with HMAC secret.

### Changed

- **Pipeline construct refactor**
  - `Pipeline` now delegates to deployment implementations via `createPipelineForType`, starting with `DeploymentType.ViteWebsite`.
  - Helper rename: `_addWebhook` → `addWebhook`.
- **Infra hardening & ergonomics**
  - Artifacts bucket encrypted with KMS; pipeline role updated with KMS permissions.
  - Site S3 bucket default policy allows CloudFront origin access; bucket retained by default.
  - Explicit pipeline stage names and ordering: `Source → Build → Deploy`.
- **Tests**
  - Rewrote `pipeline.test.ts` to synthesize a Vite pipeline end-to-end, assert stage/action names, webhook wiring, and snapshot a sanitized template.
  - Utilities now scrub volatile fields (e.g., asset keys, role names) for stable snapshots.

### Breaking

- **New props shape**
  - Removed old `PipelineProps` fields: `sourceAction`, `buildAction`, `deployAction`.
  - New required fields: `{ deploymentType, githubConfig, vite }`.
  - `GithubConfig` now passed directly; `WebhookConfig` remains `{ url }`.
- **Action names standardized**
  - Source/Build/Deploy action names are now `GitHub_Source`, `Vite_Build`, and `S3_Deploy` respectively.

### Security

- Tightened IAM for CodeBuild, S3, and CloudFront invalidation to least privilege.
- KMS usage for artifacts bucket with explicit allow list on the pipeline role.

### Migration Notes

- Replace manual action construction with typed config:
  - **Before:** pass `sourceAction`, `buildAction`, `deployAction`.
  - **After:**
    ```ts
    new Pipeline(this, "Id", {
      name: "MyPipeline",
      deploymentType: DeploymentType.ViteWebsite,
      githubConfig: { githubOwner, githubRepo, githubOAuthToken, githubBranch },
      vite: { bucket, distribution, buildCommands?: [...], env?: {...} },
      webhook?: { url }
    });
    ```
- If relying on previous action names in tests or monitoring, update to the new standardized names.

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
