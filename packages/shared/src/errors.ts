// packages/shared/src/errors.ts
// Base ALIA error class and domain errors shared across all services.
// Every service's errorHandler checks instanceof RaldAliaError to format the
// response shape: { error: { code, message } }.

export class RaldAliaError extends Error {
  readonly httpStatus: number;
  readonly code:       string;

  constructor(message: string, code: string, httpStatus: number) {
    super(message);
    this.name       = this.constructor.name;
    this.code       = code;
    this.httpStatus = httpStatus;
    // Ensures correct prototype chain in TypeScript
    Object.setPrototypeOf(this, new.target.prototype);
  }
}

// ── Alias errors ──────────────────────────────────────────────────────────────

export class AliasDuplicateError extends RaldAliaError {
  constructor(value: string) {
    super(`Alias '${value}' already exists`, 'ALIAS_DUPLICATE', 409);
  }
}

export class AliasNotFoundError extends RaldAliaError {
  constructor(id: string) {
    super(`Alias '${id}' not found`, 'ALIAS_NOT_FOUND', 404);
  }
}

// ── Compliance errors ─────────────────────────────────────────────────────────

export class ComplianceGateError extends RaldAliaError {
  readonly violations: string[];

  constructor(violations: string[]) {
    super('Alias creation rejected by compliance gate', 'COMPLIANCE_GATE_REJECTED', 422);
    this.violations = violations;
  }
}

export class ComplianceGateUnavailableError extends RaldAliaError {
  constructor(detail: string) {
    super(
      `Compliance gate unavailable: ${detail}`,
      'COMPLIANCE_GATE_UNAVAILABLE',
      503,
    );
  }
}

// ── Generic errors ────────────────────────────────────────────────────────────

export class NotFoundError extends RaldAliaError {
  constructor(resource: string, id: string) {
    super(`${resource} '${id}' not found`, 'NOT_FOUND', 404);
  }
}

export class ValidationError extends RaldAliaError {
  readonly details: unknown;
  constructor(message: string, details?: unknown) {
    super(message, 'VALIDATION_ERROR', 400);
    this.details = details;
  }
}

export class UnauthorizedError extends RaldAliaError {
  constructor(message = 'Unauthorized') {
    super(message, 'UNAUTHORIZED', 401);
  }
}

export class ForbiddenError extends RaldAliaError {
  constructor(message = 'Forbidden') {
    super(message, 'FORBIDDEN', 403);
  }
}
