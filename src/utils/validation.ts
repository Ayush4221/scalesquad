import { z } from 'zod';

// Configure before any application schema is constructed. Zod's JIT feature
// probe uses Function(), which a strict CSP reports even when Zod catches it.
z.config({ jitless: true });
export { z };
