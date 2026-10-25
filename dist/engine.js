export const API = 'https://api.spendpreflight.com';
export const OFFER = 'Get delisting alerts: [14 days free for founding sellers](https://spendpreflight.com/sellers?ref=gha).';
export const MARKER = '<!-- spendpreflight-x402-lint -->';
const object = (x) => !!x && typeof x === 'object' && !Array.isArray(x);
export function urlsInput(input) {
    const urls = input.split(/\r?\n/).map(x => x.trim()).filter(Boolean);
    if (!urls.length || urls.length > 5 || new Set(urls).size !== urls.length)
        throw Error('Provide one to five distinct public HTTPS URLs, one per line.');
    for (const s of urls) {
        let u;
        try {
            u = new URL(s);
        }
        catch {
            throw Error('Each endpoint must be a valid public HTTPS URL.');
        }
        if (s.length > 2048 || u.protocol !== 'https:' || u.username || u.password || u.hash || u.port && u.port !== '443' || u.hostname === 'localhost' || u.hostname.endsWith('.localhost') || u.hostname.endsWith('.local') || u.hostname.startsWith('[') || /^\d+\.\d+\.\d+\.\d+$/.test(u.hostname))
            throw Error('Use public HTTPS hostnames without credentials, fragments or custom ports.');
    }
    return urls;
}
export function boolInput(value, name) { if (value === 'true')
    return true; if (value === 'false')
    return false; throw Error(`${name} must be true or false.`); }
/** Responses remain in memory only and are bounded even if Content-Length is missing. */
export async function readJson(response, limit = 262144) {
    if (!response.body)
        throw Error('Empty service response.');
    const reader = response.body.getReader(), chunks = [];
    let size = 0;
    try {
        while (true) {
            const { value, done } = await reader.read();
            if (done)
                break;
            size += value.length;
            if (size > limit)
                throw Error('Service response exceeds the limit.');
            chunks.push(value);
        }
    }
    finally {
        await reader.cancel().catch(() => { });
    }
    const all = new Uint8Array(size);
    let at = 0;
    for (const c of chunks) {
        all.set(c, at);
        at += c.length;
    }
    try {
        return JSON.parse(new TextDecoder().decode(all));
    }
    catch {
        throw Error('Malformed service response.');
    }
}
export function assess(value, now = Date.now()) {
    if (!object(value) || typeof value.id !== 'string' || !/^[a-f0-9]{8}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{4}-[a-f0-9]{12}$/.test(value.id) || typeof value.expires_at !== 'string' || !Number.isFinite(Date.parse(value.expires_at)) || Date.parse(value.expires_at) <= now || !Array.isArray(value.findings))
        throw Error('Invalid or expired report evidence.');
    const findings = value.findings;
    if (findings.length > 100 || findings.some(f => !object(f) || !['error', 'warning', 'info'].includes(String(f.level)) || typeof f.code !== 'string' || !/^[a-z0-9_]{1,80}$/.test(f.code)))
        throw Error('Invalid report findings.');
    const guard = object(value.listingGuard) ? value.listingGuard : null;
    const score = typeof guard?.riskScore === 'number' && Number.isFinite(guard.riskScore) && guard.riskScore >= 0 && guard.riskScore <= 100 ? guard.riskScore : null;
    const errors = findings.some(f => f.level === 'error');
    const complete = value.outcome === 'challenge_observed' && value.http_status === 402 && value.challenge_shape_valid === true && value.resource_matches === true && score !== null;
    const conclusion = errors ? 'failing' : !complete ? 'inconclusive' : findings.some(f => f.level === 'warning') || score > 0 ? 'review' : 'passing';
    const report = `${API}/lint/reports/${value.id}?ref=gha`, badge = `${API}/v1/lint/reports/${value.id}/badge.svg`;
    return { conclusion, score, report, badge, codes: findings.map(f => f.code).slice(0, 8), reason: errors ? 'Hard findings require review.' : !complete ? 'No complete usable unpaid GET evidence; not proof the endpoint is down.' : 'Unpaid GET snapshot only; review heuristic findings in context.' };
}
export async function lintUrls(urls, fetcher = fetch) {
    const results = [];
    for (const url of urls) {
        try {
            const response = await fetcher(`${API}/v1/lint?ref=gha`, { method: 'POST', headers: { 'Content-Type': 'application/json', Accept: 'application/json' }, body: JSON.stringify({ url }), redirect: 'error', signal: AbortSignal.timeout(75000) });
            if (response.status !== 200) {
                await response.body?.cancel();
                results.push({ conclusion: 'inconclusive', score: null, report: null, badge: null, codes: [], reason: `Free service unavailable (HTTP ${response.status}); no automatic retry or payment.` });
                continue;
            }
            results.push(assess(await readJson(response)));
        }
        catch {
            results.push({ conclusion: 'inconclusive', score: null, report: null, badge: null, codes: [], reason: 'Check unavailable or report invalid; no automatic retry or payment.' });
        }
    }
    return results;
}
export function summary(items) {
    const conclusion = items.some(x => x.conclusion === 'failing') ? 'failing' : items.some(x => x.conclusion === 'inconclusive') ? 'inconclusive' : items.some(x => x.conclusion === 'review') ? 'review' : 'passing';
    const scores = items.map(x => x.score).filter((x) => x !== null);
    const badges = items.filter(x => x.report && x.badge).map(x => `[![x402 Lint](${x.badge})](${x.report})`).join('\n');
    const body = `${MARKER}\n## x402 Lint\n\n| Check | Result | Risk / 100 | Report |\n| --- | --- | --- | --- |\n${items.map((x, i) => `| ${i + 1} | ${x.conclusion} | ${x.score ?? 'unknown'} | ${x.report ? `[Seven-day snapshot](${x.report})` : 'Unavailable'} |`).join('\n')}\n\n${items.map((x, i) => `- Check ${i + 1}: ${x.reason}${x.codes.length ? ' Codes: ' + x.codes.map(c => '\x60' + c + '\x60').join(', ') + '.' : ''}`).join('\n')}\n\nHeuristic scores can include legitimate URLs. This does not verify safety, paid delivery, facilitator support or Coinbase acceptance. GET-only; POST bodies are not tested. Free quotas and robots apply.\n\n${OFFER} First 10 eligible Basic registrations; no wallet to start, then 9 USDC / 31 days, manual renewal. Alerts are best effort.\n\n<details><summary>README badges (dated, expire after seven days)</summary>\n\n\x60\x60\x60markdown\n${badges}\n\x60\x60\x60\n\nBadges read existing reports only. Update the report ID after a new run; GitHub may cache images. Passing covers only the fields tested.\n</details>\n`;
    return { conclusion, maxScore: scores.length ? String(Math.max(...scores)) : 'unknown', reports: items.flatMap(x => x.report ? [x.report] : []), badges, body };
}
/** No privileged fork workaround. Only the invoking repository's ordinary pull_request event. */
export function commentTarget(event, eventName, repository) {
    if (eventName !== 'pull_request' || !/^[-\w.]+\/[-\w.]+$/.test(repository) || !object(event) || !object(event.pull_request) || !object(event.repository))
        return null;
    const p = event.pull_request;
    if (event.repository.full_name !== repository || !object(p.base) || !object(p.base.repo) || p.base.repo.full_name !== repository || !object(p.head) || !object(p.head.repo) || p.head.repo.full_name !== repository || typeof event.number !== 'number' || !Number.isSafeInteger(event.number) || event.number <= 0)
        return null;
    return { repository, number: event.number };
}
export async function commentResults(target, token, body, fetcher = fetch) {
    const base = `https://api.github.com/repos/${target.repository}`, headers = { Authorization: `Bearer ${token}`, Accept: 'application/vnd.github+json', 'X-GitHub-Api-Version': '2022-11-28', 'Content-Type': 'application/json' };
    let found, complete = false;
    for (let page = 1; page <= 3; page++) {
        const r = await fetcher(`${base}/issues/${target.number}/comments?per_page=100&page=${page}`, { headers, redirect: 'error', signal: AbortSignal.timeout(15000) });
        if (r.status !== 200) {
            await r.body?.cancel();
            return false;
        }
        const comments = await readJson(r, 1048576);
        if (!Array.isArray(comments))
            return false;
        const own = comments.find(c => object(c) && typeof c.body === 'string' && c.body.startsWith(MARKER) && object(c.user) && c.user.login === 'github-actions[bot]' && c.user.type === 'Bot' && typeof c.id === 'number' && Number.isSafeInteger(c.id) && c.id > 0);
        if (own) {
            found = own.id;
            complete = true;
            break;
        }
        if (comments.length < 100) {
            complete = true;
            break;
        }
    }
    if (!complete)
        return false;
    const r = await fetcher(found ? `${base}/issues/comments/${found}` : `${base}/issues/${target.number}/comments`, { method: found ? 'PATCH' : 'POST', headers, body: JSON.stringify({ body }), redirect: 'error', signal: AbortSignal.timeout(15000) });
    await r.body?.cancel();
    return r.status === (found ? 200 : 201);
}
