export declare const requiredNames: readonly string[];
export declare function readTestEnvironment(env: Record<string, string | undefined>): {
  homeserver: string;
  a: string;
  aPassword: string;
  b: string;
  bPassword: string;
  timeoutMs: number;
};
