// Ambient type to silence TS errors when frontend code references Deno
// This does not polyfill runtime; it only provides types for typechecking.
declare const Deno:
  | undefined
  | {
      env: {
        get(name: string): string | undefined;
      };
    };
