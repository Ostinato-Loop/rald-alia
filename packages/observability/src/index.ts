// packages/observability/src/index.ts
// Side-effect import: initialises the OTEL SDK (tracer.ts) when this
// package is first required. Must be the first import in service index.ts.

import './tracer';

// Public API
export * from './trace';
export * from './metrics';
export * from './kafka';
