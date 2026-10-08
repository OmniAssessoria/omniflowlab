declare module "bun:test" {
  export function describe(name: string, fn: () => void): void;
  export function test(name: string, fn: () => void | Promise<void>): void;
  export function expect<T>(value: T): {
    toBe(expected: T): void;
    toEqual(expected: unknown): void;
    toBeTruthy(): void;
    toBeFalsy(): void;
    toBeNull(): void;
    toBeUndefined(): void;
    toBeDefined(): void;
    toContain(expected: unknown): void;
    toHaveLength(expected: number): void;
    toBeGreaterThan(expected: number): void;
    toBeLessThan(expected: number): void;
    toMatch(expected: string | RegExp): void;
    not: {
      toBe(expected: unknown): void;
      toEqual(expected: unknown): void;
      toContain(expected: unknown): void;
      toBeNull(): void;
      toBeUndefined(): void;
      toBeDefined(): void;
    };
  };
}

// Global Bun runtime object used directly by test files (Bun.file).
declare const Bun: {
  file(path: string | URL): { text(): Promise<string> };
  test: typeof import("bun:test").test;
  describe: typeof import("bun:test").describe;
};
