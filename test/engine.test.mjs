import {test} from 'node:test';
import assert from 'node:assert/strict';
import {urlsInput,boolInput,assess,lintUrls,summary,commentTarget,commentResults,MARKER,readJson} from '../dist/engine.js';
const id='11111111-1111-4111-8111-111111111111';
const report=(extra={})=>({id,expires_at:new Date(Date.now()+60000).toISOString(),outcome:'challenge_observed',http_status:402,challenge_shape_valid:true,resource_matches:true,listingGuard:{riskScore:0},findings:[],...extra});
test('bounded explicit HTTPS inputs only; never silently drops invalid endpoints',()=>{
 assert.deepEqual(urlsInput('https://example.com/a\nhttps://api.example.org/b'),['https://example.com/a','https://api.example.org/b']);
 for(const input of ['', 'http://example.com','https://u:p@example.com','https://127.0.0.1','https://[::1]','https://localhost','https://example.local','https://example.com:8080','https://example.com/#x',Array(6).fill('https://example.com').join('\n')])assert.throws(()=>urlsInput(input));
 assert.equal(boolInput('false','comment'),false);assert.throws(()=>boolInput('yes','comment'));
});
test('hard errors fail; positive heuristics or conditional warnings require review, not a broken endpoint allegation',()=>{
 assert.equal(assess(report()).conclusion,'passing');
 assert.equal(assess(report({listingGuard:{riskScore:15}})).conclusion,'review');
 assert.equal(assess(report({findings:[{level:'warning',code:'cors_origin_missing'}]})).conclusion,'review');
 assert.equal(assess(report({outcome:'issues_found',findings:[{level:'error',code:'invalid_network'}]})).conclusion,'failing');
 for(const value of [{outcome:'inconclusive'},{challenge_shape_valid:false},{resource_matches:false},{http_status:405},{listingGuard:{riskScore:null}}])assert.equal(assess(report(value)).conclusion,'inconclusive');
});
test('expired/malformed/injected response fields never become a passing report or executable Markdown',()=>{
 for(const value of [{expires_at:'bad'},{expires_at:'2020-01-01'}, {id:'https://evil.test'}, {findings:[{level:'info',code:'x\n::error::oops'}]}])assert.throws(()=>assess(report(value)));
 const r=summary([assess(report({report_url:'https://evil.test',resource:'private?key=secret',findings:[{level:'info',code:'schema_unchecked',fix:'[click](https://evil.test)'}]}))]);
 assert.ok(r.body.includes('https://api.spendpreflight.com/lint/reports/'+id+'?ref=gha'));assert.ok(!/private|secret|evil\.test/.test(r.body));assert.ok(r.body.includes('14 days free for founding sellers'));assert.ok(r.badges.includes('/badge.svg'));
});
test('sequential single attempts use only fixed free Lint API with ref=gha, no payment/token/redirect/retry',async()=>{
 const calls=[];let active=0;const fake=async(url,init)=>{assert.equal(active++,0);await Promise.resolve();calls.push([url,init]);active--;return Response.json(report());};
 const result=await lintUrls(['https://a.example/path','https://b.example/path'],fake);assert.equal(result.length,2);assert.equal(calls.length,2);
 for(const [url,init] of calls){assert.equal(url,'https://api.spendpreflight.com/v1/lint?ref=gha');assert.equal(init.redirect,'error');assert.equal(init.method,'POST');assert.deepEqual(Object.keys(JSON.parse(init.body)),['url']);assert.ok(!new Headers(init.headers).has('authorization'));assert.ok(!new Headers(init.headers).has('payment-signature'));}
});
test('quota/network/invalid response remains inconclusive without retry or pay-around',async()=>{
 for(const status of [429,503,302]){let calls=0;const r=await lintUrls(['https://a.example'],async()=>{calls++;return new Response('',{status});});assert.equal(calls,1);assert.equal(r[0].conclusion,'inconclusive');}
 const r=await lintUrls(['https://a.example'],async()=>{throw Error('private server body');});assert.equal(r[0].conclusion,'inconclusive');assert.ok(!JSON.stringify(r).includes('private server body'));
 await assert.rejects(readJson(new Response('x'.repeat(1024)),16));
});
const event={number:12,repository:{full_name:'seller/api'},pull_request:{base:{repo:{full_name:'seller/api'}},head:{repo:{full_name:'seller/api'}}}};
test('comments are allowed only on ordinary same-repository PRs, never fork/privileged target or unrelated repositories',()=>{
 assert.deepEqual(commentTarget(event,'pull_request','seller/api'),{repository:'seller/api',number:12});
 assert.equal(commentTarget(event,'pull_request_target','seller/api'),null);assert.equal(commentTarget(event,'push','seller/api'),null);assert.equal(commentTarget(event,'pull_request','other/repo'),null);
 assert.equal(commentTarget({...event,pull_request:{...event.pull_request,head:{repo:{full_name:'fork/api'}}}},'pull_request','seller/api'),null);
});
test('updates only own bot marker, never edits a human/other bot comment; fixed API URL and no redirects',async()=>{
 const calls=[];const fake=async(url,init)=>{calls.push([url,init]);if(calls.length===1)return Response.json([{id:1,body:MARKER,user:{login:'human',type:'User'}},{id:7,body:MARKER,user:{login:'github-actions[bot]',type:'Bot'}}]);return Response.json({}, {status:200});};
 assert.equal(await commentResults({repository:'seller/api',number:12},'not-a-real-token','safe body',fake),true);assert.equal(calls[1][0],'https://api.github.com/repos/seller/api/issues/comments/7');assert.equal(calls[1][1].method,'PATCH');assert.equal(calls[1][1].redirect,'error');
});
test('deduplication stops on a full bounded comment history instead of posting a possible duplicate; 403 is nonfatal',async()=>{
 let calls=0;assert.equal(await commentResults({repository:'seller/api',number:12},'fake','body',async()=>{calls++;return Response.json(Array(100).fill({body:'other'}));}),false);assert.equal(calls,3);
 assert.equal(await commentResults({repository:'seller/api',number:12},'fake','body',async()=>new Response('',{status:403})),false);
});
