import { Construct } from "constructs";

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
   * Webhook configuration
   */
  webhook?: WebhookConfig;
}

export class Pipeline extends Construct {
  constructor(scope: Construct, id: string, props: PipelineProps) {
    super(scope, id);
  }
}
