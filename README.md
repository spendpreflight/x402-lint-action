<p><img src="brand/logo-shield-128.png" width="96" height="96" alt="SpendPreflight shield and check"></p>

# x402 Lint

SpendPreflight — trust and verification tools for stablecoin payments, built for AI agents and the people who run them.

[All tools](https://spendpreflight.com/tools/) · [Trust and privacy](https://spendpreflight.com/trust.html)

Free unpaid x402 endpoint checks in GitHub Actions, operated by **SpendPreflight**. No Lint API key, wallet or payment. Get a heuristic Listing Guard risk score, seven-day report and README badge on every push.

Add these three lines to a job:

```yaml
- uses: spendpreflight/x402-lint-action@v1
  with:
    urls: https://api.example.com/resource
```

Use a public, non-sensitive endpoint you operate. This is a GET-only snapshot; it cannot execute a POST request body, prove paid delivery, certify safety or guarantee Coinbase acceptance. A positive score may reflect legitimate documentation URLs.

## New tools alongside the free Action

The existing Lint snapshot includes a free passive Security Check coverage summary. The Action does not call paid tools or make payments.

- [x402 Security Check](https://spendpreflight.com/tools/x402-security-check/): optionally inspect a full report from a current complete saved Lint snapshot for0.10 USDC, without another probe or a shared trial. Passive observations do not establish replay protection, paid-cache behavior or settlement correctness.
- [Quote Check](https://spendpreflight.com/tools/quote-check/): compare a supplied exact quote with cached public evidence for0.001 USDC when usable; unknown without charge, no shared trial. It makes no target request and does not authorize payment.
- [Seller Index](https://spendpreflight.com/tools/seller-index/): top three cached public matches free; extended results up to12 cost0.01 USDC only when extra matches exist. It makes no new crawl and does not certify seller safety.

[Read the new-tools announcement](https://spendpreflight.com/blog/new-x402-verification-tools.html). These are optional web/API/MCP tools; the existing Action code, free-check quota and `@v1` release stay as documented below.

## Complete workflow

```yaml
name: x402 Lint
on: [push, pull_request]
permissions:
  contents: read
  pull-requests: write # optional, for one updated PR summary
concurrency:
  group: x402-lint-${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: false
jobs:
  lint:
    runs-on: ubuntu-latest
    timeout-minutes: 10
    steps:
      - uses: spendpreflight/x402-lint-action@v1
        with:
          urls: |
            https://api.example.com/resource
            https://api.example.org/another-resource
```

The action makes **one sequential free Lint attempt per URL**, at most five per run, with no automatic retry, payment or alternate endpoint. The service honors robots, DNS protection and host pacing. The existing approximate 10/minute location limit and hard shared 200/day service budget apply; this is not a reserved or unlimited CI allowance. Repeated pushes and multiple jobs share capacity. Use one job and avoid duplicate push/PR checks when configuring your workflow.

No checkout is needed to check an already published endpoint. CI cannot inspect an undeployed local build. Free checks send the endpoint URL to `https://api.spendpreflight.com/v1/lint?ref=gha`; do not submit private URLs or credentials. No target POST body is accepted or sent.

## Results and build failures

- **failing:** hard findings in the report; exit 1. Review the exact finding against your SDK, facilitator and specification before concluding an integration is broken.
- **review:** warnings or a positive heuristic score; exit 0. Conditional CORS notes and legitimate schema URLs are not proof of an attack, outage or imminent delisting.
- **passing:** a valid matching unpaid GET challenge, assessed score zero and no warning/error findings; exit 0. Only the fields tested passed.
- **inconclusive:** robots, quotas, network errors, unsupported GET/POST-only routes, missing or malformed evidence; exit 2 by default. This is not evidence the endpoint is down. Set `fail-on-inconclusive: 'false'` to keep this result non-blocking; the result still says inconclusive.

Each run writes derived results to the job summary. On an ordinary `pull_request` event from the **same repository**, it can create or update one summary comment as `github-actions[bot]`, using the workflow's generated GitHub token. The token is used only with the fixed GitHub API, never the Lint service. Set `comment: 'false'` to disable comments. Fork PRs and `pull_request_target` events are skipped; lack of comment permission warns without hiding the Lint result. Do not grant broader credentials or use a privileged fork workaround. The action does not post sales outreach or issues on sellers' repositories.

Inputs: `urls` (required, newline-separated, up to five distinct public HTTPS hostnames); `comment` (default `true`); `token` (default `${{ github.token }}`, optional comments only); `fail-on-inconclusive` (default `true`). Booleans must be literal `true` or `false`. Custom ports, URL credentials and fragments are rejected. Redirects from the fixed APIs are not followed.

Outputs: `conclusion`, `max-risk-score` (number or `unknown`), `report-urls` (JSON array), `badge-markdown`. A skipped or inconclusive check never silently becomes passing.

## README badge

Copy `badge-markdown` from the job summary/output:

```markdown
[![x402 Lint](https://api.spendpreflight.com/v1/lint/reports/REPORT_ID/badge.svg)](https://api.spendpreflight.com/lint/reports/REPORT_ID?ref=gha)
```

Replace `REPORT_ID` with the actual completed report ID. A badge reads that **existing report only**; opening it never runs a check or consumes Lint quota. It shows passing, review, failing or unknown, plus the score when assessed. Missing/expired/inconclusive evidence is unknown. Reports expire after seven days: update the ID after another run. GitHub may cache images, so use the linked observation date and report as the source of truth. The badge does not certify safety, listing status or payment support.

## Privacy and monitoring

The action code emits only derived results: no request/response bodies, endpoint query values, tokens or raw submitted URLs in its own output, summary or PR comment. GitHub can display workflow configuration and action inputs in run logs, so submit only public, non-sensitive URLs. The API keeps only its existing allowlisted derived seven-day public report, which omits query values and raw response bodies. A report link can be read by anyone who has it. GitHub retains derived summaries/comments under the repository's settings; disable comments for a quieter workflow.

The fixed `gha` campaign counts only UTC day, stage and count for up to 90 days—no user, repository, IP, email, cookie, session or linked journey. These are spoofable event counts, not unique people or customer conversions. [Service privacy](https://api.spendpreflight.com/privacy).

Get delisting alerts: [14 days free for founding sellers](https://spendpreflight.com/sellers?ref=gha). First 10 eligible Basic registrations, no wallet to start; then 9 USDC per 31 days, manually renewed. Availability is confirmed at registration. Best-effort daily listing-risk/removal observations and hourly endpoint checks; observation and email delivery can be delayed. The action never registers, renews or pays automatically.

## Versioning and development

Use `@v1` for the current major release, an exact version, or the full release commit SHA for a fixed dependency. Node.js 24 runs the action. It has no runtime package dependencies; the compiled `dist/` files are committed and CI checks they match the TypeScript source.

```sh
npm ci --ignore-scripts
npm run typecheck
npm test
```

Tests use synthetic responses and mock GitHub APIs, including the actual CLI entrypoint. They do not call a seller, consume a free check, send a real PR comment or make a payment. MIT licensed. Contact: [contact@spendpreflight.com](mailto:contact@spendpreflight.com).
