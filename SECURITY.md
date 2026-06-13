# Security Policy — RALD ALIA

**LILCKY STUDIO LIMITED**

## Supported Versions

| Version | Supported |
|---------|-----------|
| `main` branch (latest) | ✅ Active |
| Tagged releases `v*` | ✅ 12 months from release date |
| Older releases | ❌ Not supported |

## Reporting a Vulnerability

**Please do not file a public GitHub issue for security vulnerabilities.**

### Preferred channel

Email **security@rald.cloud** with:

1. A concise description of the vulnerability
2. Steps to reproduce (or a minimal proof-of-concept)
3. The affected service(s) and version/commit hash
4. Your assessment of impact and severity (CVSS score if possible)
5. Whether you are requesting CVE assignment

We will acknowledge receipt within **24 hours** and provide an initial assessment within **72 hours**.

### What happens next

| Timeline | Action |
|----------|--------|
| 0–24 h   | Acknowledgement |
| 24–72 h  | Initial triage and severity assessment |
| 7 days   | Patch or mitigation plan shared with reporter |
| 30 days  | Coordinated public disclosure (unless severity requires faster action) |
| 90 days  | Maximum embargo period for critical vulnerabilities |

### Scope — in scope

- All services in `services/`
- All shared packages in `packages/`
- The ALIA API gateway and resolution engine
- Machine identity (JWT issuance, scope enforcement)
- Developer API key issuance and verification
- Trust, consent, and governance services
- AWS infrastructure configurations in `infrastructure/`
- The OTEL Collector configuration
- CI/CD pipeline security (`.github/workflows/`)

### Scope — out of scope

- Issues in dependencies (report to the upstream project; we track via Dependabot)
- Rate limiting bypass via IP rotation (by design — rate limits are advisory, not the primary defence)
- Social engineering or phishing attacks
- Findings from automated scanners without manual validation (automated reports are deprioritised)
- Issues requiring physical access to infrastructure

### Safe harbour

We will not take legal action against security researchers who:
- Disclose via email before public disclosure
- Do not access, exfiltrate, or modify production data
- Do not perform denial-of-service attacks
- Do not disclose to third parties before coordinated disclosure

### Bug bounty

RALD ALIA does not currently operate a paid bug bounty programme. We will acknowledge researchers in our release notes and, for critical findings, provide recognition in our public changelog.

---

## Security controls summary

| Control | Implementation |
|---------|---------------|
| Auth (machine-to-machine) | HMAC-SHA256 machine JWTs — `packages/shared/src/machineJwt.ts` |
| Auth (developer API) | `rald_key_{prod\|test}_{48hex}`, SHA-256 hash stored |
| Transport | TLS 1.2+ enforced at ALB; HSTS 1 year |
| Input validation | Zod schemas on all routes — `packages/shared/src/validate.ts` |
| Rate limiting | Per-tier express-rate-limit — `packages/shared/src/security.ts` |
| Secret management | AWS Secrets Manager — no secrets in env or code |
| Secret rotation | Monthly automated rotation via `.github/workflows/rotate-machine-secrets.yml` |
| Dependency scanning | Weekly Dependabot + weekly `npm audit` in CI |
| Static analysis | CodeQL on every PR and push to main |
| Secret scanning | Gitleaks on every commit |
| Container scanning | Trivy on built images (HIGH/CRITICAL alerts) |
| Observability | OTEL traces + CloudWatch alerts — `packages/observability/` |
