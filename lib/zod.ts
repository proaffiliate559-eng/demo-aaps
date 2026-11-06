import { z } from "zod";

// Our CSP forbids eval. Zod v4 otherwise probes `new Function()` to enable a
// JIT fast path, which the browser reports as a CSP violation. Disable it.
z.config({ jitless: true });

export { z };
export type { ZodError, ZodType } from "zod";
