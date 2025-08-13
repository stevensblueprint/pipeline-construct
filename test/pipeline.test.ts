import { App, Stack } from "aws-cdk-lib";
import { Pipeline } from "../lib";

test("Pipeline is created with webhook", () => {
  const app = new App();
  const stack = new Stack(app, "TestStack");
  new Pipeline(stack, "TestPipeline", {
    name: "TestPipeline",
    webhook: {
      url: "https://example.com/webhook",
    },
  });
});
