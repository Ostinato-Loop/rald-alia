# @rald-alia/sdk

Official TypeScript SDK for the **ALIA Financial Identity Network** — Africa's open, interoperable financial identity layer.

## Installation

```bash
npm install @rald-alia/sdk
# or
pnpm add @rald-alia/sdk
```

## Quick start

```ts
import { AliaSDK } from '@rald-alia/sdk';

const alia = new AliaSDK({
  apiKey: process.env.ALIA_API_KEY!, // rald_key_prod_* or rald_key_test_*
});
```

## Configuration

| Option | Type | Default | Description |
|---|---|---|---|
| `apiKey` | `string` | **required** | Your ALIA API key |
| `baseUrl` | `string` | `https://api.alia.network` | Override for staging/self-hosted |
| `timeoutMs` | `number` | `30000` | Per-request timeout in ms |
| `maxRetries` | `number` | `2` | Retries on 5xx / rate-limit |
| `headers` | `Record<string,string>` | `{}` | Extra headers on every request |

---

## Alias

> Required scopes: `alias:resolve`, `alias:create`, `alias:read`

```ts
// Resolve a phone number to routing metadata
const alias = await alia.alias.resolve({
  alias:   '+2348012345678',
  country: 'NG',
});

console.log(alias.routing.account_number); // → '0123456789'

// Register a new alias
const created = await alia.alias.create({
  alias:    'merchant@store',
  type:     'email',
  country:  'NG',
  routing:  { bank_code: '058', account_number: '0123456789' },
});
```

---

## Identity

> Required scope: `identity:verify`

```ts
const verification = await alia.identity.verify({
  subject_id:      'subj_abc123',
  country:         'NG',
  document_type:   'bvn',
  document_number: '22312345678',
  first_name:      'Amara',
  last_name:       'Okafor',
});

// Poll until verified
const result = await alia.identity.get(verification.id);
console.log(result.status); // 'pending' | 'verified' | 'failed'
```

---

## Trust

> Required scope: `trust:read`

```ts
const score = await alia.trust.getScore('entity_xyz');
console.log(score.score, score.tier); // 87, 'high'
```

---

## Consent

> Required scopes: `consent:grant`, `consent:read`

```ts
// Request consent on behalf of your application
const consent = await alia.consent.grant({
  subject_id:     'user_abc',
  requestor_id:   'your-app-id',
  scope:          ['alias:resolve', 'routing:initiate'],
  expires_in_days: 90,
});

// Read existing consents
const consents = await alia.consent.list('user_abc');
```

---

## Routing

> Required scope: `routing:initiate`

```ts
import { crypto } from 'crypto'; // or import { randomUUID } from 'crypto'

const payment = await alia.routing.initiate({
  source_alias:      '+2348012345678',
  destination_alias: '+2349087654321',
  amount_minor:      500_000,   // ₦5,000 in kobo
  currency:          'NGN',
  narration:         'Invoice #INV-001',
  idempotency_key:   randomUUID(),
});

console.log(payment.status); // 'initiated'

// Poll for settlement
const settled = await alia.routing.get(payment.id);
console.log(settled.status); // 'settled'
```

---

## Registry

> Required scope: `registry:read`

```ts
// Full 7-dimension entity status
const record = await alia.registry.get('entity_xyz');
console.log(record.alias_status, record.kyc_level, record.trust_tier);

// Look up by alias
const byAlias = await alia.registry.getByAlias('+2348012345678', 'NG');
```

---

## Error handling

All errors are typed and inherit from `AliaError`.

```ts
import {
  AliaAuthError,
  AliaRateLimitError,
  AliaCountryNotOperationalError,
  AliaNotFoundError,
} from '@rald-alia/sdk';

try {
  const alias = await alia.alias.resolve({ alias: '...', country: 'NG' });
} catch (err) {
  if (err instanceof AliaAuthError) {
    console.error('Invalid API key — check ALIA_API_KEY');
  } else if (err instanceof AliaRateLimitError) {
    console.error(`Rate limit hit. Retry in ${err.retryAfterMs}ms`);
  } else if (err instanceof AliaCountryNotOperationalError) {
    console.error('Country not yet live on the ALIA network');
  } else if (err instanceof AliaNotFoundError) {
    console.error('Alias not found');
  } else {
    throw err;
  }
}
```

| Error class | HTTP status | When |
|---|---|---|
| `AliaAuthError` | 401 | Invalid or revoked API key |
| `AliaForbiddenError` | 403 | Scope not granted |
| `AliaNotFoundError` | 404 | Resource doesn't exist |
| `AliaCountryNotOperationalError` | 451 | Country is DISABLED or not yet operational |
| `AliaRateLimitError` | 429 | Rate limit exceeded (has `.retryAfterMs`) |
| `AliaNetworkError` | — | Fetch / network failure |
| `AliaApiError` | any | Generic API error with `.status`, `.code`, `.requestId` |

---

## Rate limits

| Environment | Requests/min | Requests/day |
|---|---|---|
| Sandbox (`rald_key_test_*`) | 60 | 10,000 |
| Production (`rald_key_prod_*`) | 120 | 50,000 |

The SDK automatically retries on 429 using the `Retry-After` header (up to `maxRetries` times).

---

## Environments

| Base URL | Key prefix | Use for |
|---|---|---|
| `https://api.alia.network` | `rald_key_prod_*` | Production |
| `https://sandbox.alia.network` | `rald_key_test_*` | Development & testing |

---

## TypeScript support

The SDK is written in TypeScript and ships full type declarations. All request/response types are exported from the package root.

```ts
import type { Alias, RoutingRequest, TrustScore } from '@rald-alia/sdk';
```

---

## License

MIT © RALD Technologies
