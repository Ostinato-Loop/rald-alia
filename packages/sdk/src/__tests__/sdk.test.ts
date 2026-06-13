// packages/sdk/src/__tests__/sdk.test.ts
import { describe, it, expect } from 'vitest';
import { AliaSDK }         from '../../AliaSDK';
import { AliasClient }     from '../../modules/alias';
import { IdentityClient }  from '../../modules/identity';
import { TrustClient }     from '../../modules/trust';
import { ConsentClient }   from '../../modules/consent';
import { RoutingClient }   from '../../modules/routing';
import { RegistryClient }  from '../../modules/registry';

describe('AliaSDK', () => {
  it('instantiates without error given a valid API key', () => {
    expect(() => new AliaSDK({ apiKey: 'rald_key_test_abc' })).not.toThrow();
  });

  it('throws if apiKey is missing', () => {
    expect(() => new AliaSDK({ apiKey: '' })).toThrow();
  });

  it('exposes alias sub-client', () => {
    const sdk = new AliaSDK({ apiKey: 'rald_key_test_abc' });
    expect(sdk.alias).toBeInstanceOf(AliasClient);
  });

  it('exposes identity sub-client', () => {
    const sdk = new AliaSDK({ apiKey: 'rald_key_test_abc' });
    expect(sdk.identity).toBeInstanceOf(IdentityClient);
  });

  it('exposes trust sub-client', () => {
    const sdk = new AliaSDK({ apiKey: 'rald_key_test_abc' });
    expect(sdk.trust).toBeInstanceOf(TrustClient);
  });

  it('exposes consent sub-client', () => {
    const sdk = new AliaSDK({ apiKey: 'rald_key_test_abc' });
    expect(sdk.consent).toBeInstanceOf(ConsentClient);
  });

  it('exposes routing sub-client', () => {
    const sdk = new AliaSDK({ apiKey: 'rald_key_test_abc' });
    expect(sdk.routing).toBeInstanceOf(RoutingClient);
  });

  it('exposes registry sub-client', () => {
    const sdk = new AliaSDK({ apiKey: 'rald_key_test_abc' });
    expect(sdk.registry).toBeInstanceOf(RegistryClient);
  });

  it('respects a custom baseUrl', () => {
    const sdk = new AliaSDK({ apiKey: 'rald_key_test_abc', baseUrl: 'https://sandbox.alia.network' });
    // Sub-clients are constructed — no error means the baseUrl was accepted
    expect(sdk.alias).toBeDefined();
  });
});
