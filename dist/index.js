import { appendFile, readFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import { boolInput, urlsInput, lintUrls, summary, commentTarget, commentResults, OFFER } from './engine.js';
const escape = (s) => s.replaceAll('%', '%25').replaceAll('\r', '%0D').replaceAll('\n', '%0A');
async function main() {
    const input = (name, fallback = '') => process.env['INPUT_' + name.toUpperCase()] ?? fallback;
    const urls = urlsInput(input('urls')), comment = boolInput(input('comment', 'true'), 'comment'), strict = boolInput(input('fail-on-inconclusive', 'true'), 'fail-on-inconclusive');
    const items = await lintUrls(urls), result = summary(items);
    if (process.env.GITHUB_OUTPUT) {
        for (const [name, value] of Object.entries({ 'conclusion': result.conclusion, 'max-risk-score': result.maxScore, 'report-urls': JSON.stringify(result.reports), 'badge-markdown': result.badges })) {
            const delimiter = 'lint_' + randomUUID();
            await appendFile(process.env.GITHUB_OUTPUT, `${name}<<${delimiter}\n${value}\n${delimiter}\n`);
        }
    }
    if (process.env.GITHUB_STEP_SUMMARY)
        await appendFile(process.env.GITHUB_STEP_SUMMARY, result.body);
    console.log(`x402 Lint: ${result.conclusion}; max heuristic risk ${result.maxScore}/100. Unpaid GET snapshot only.`);
    for (const report of result.reports)
        console.log('Report: ' + report);
    console.log(OFFER);
    if (comment && input('token') && process.env.GITHUB_EVENT_PATH) {
        try {
            const event = JSON.parse(await readFile(process.env.GITHUB_EVENT_PATH, 'utf8'));
            const target = commentTarget(event, process.env.GITHUB_EVENT_NAME ?? '', process.env.GITHUB_REPOSITORY ?? '');
            if (target && !await commentResults(target, input('token'), result.body))
                console.log('::warning::PR summary could not be written; check pull-requests write permission. Results remain in the job summary. No retry or privilege escalation.');
            else if (!target)
                console.log('PR comment skipped: ordinary same-repository pull_request event required.');
        }
        catch {
            console.log('::warning::PR summary unavailable; results remain in the job summary.');
        }
    }
    if (result.conclusion === 'failing') {
        console.log('::error::x402 Lint found hard errors. Review the dated report; this is not a safety or payment-support verdict.');
        process.exitCode = 1;
    }
    else if (result.conclusion === 'inconclusive' && strict) {
        console.log('::error::x402 Lint could not complete a check. This is missing evidence, not proof an endpoint is down.');
        process.exitCode = 2;
    }
}
main().catch(() => { console.log(`::error::${escape('x402 Lint configuration or output failed. Supply one to five public HTTPS URLs and true/false settings. No submitted URL or service body is logged.')}`); process.exitCode = 2; });
