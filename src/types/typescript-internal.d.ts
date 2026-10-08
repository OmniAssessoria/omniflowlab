// Augments the TypeScript module with runtime-only APIs used by tests.
import "typescript";

declare module "typescript" {
  interface SourceFile {
    parseDiagnostics: readonly unknown[];
  }
}
