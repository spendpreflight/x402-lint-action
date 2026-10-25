import {test} from 'node:test';import assert from 'node:assert/strict';import {spawnSync} from 'node:child_process';import {mkdtemp,readFile,rm} from 'node:fs/promises';import {resolve,join} from 'node:path';import {pathToFileURL} from 'node:url';
for(const [mode,exit] of [['pass',0],['error',1],['unknown',2]])test('real entrypoint writes safe derived outputs: '+mode,async()=>{
 const dir=await mkdtemp(resolve('.test-'));try{
  const out=join(dir,'output'),summary=join(dir,'summary');
  const r=spawnSync(process.execPath,['--import',pathToFileURL(resolve('test/offline-register.mjs')).href,resolve('dist/index.js')],{env:{...process.env,'INPUT_URLS':'https://seller.example/data?city=private-value','INPUT_COMMENT':'false','INPUT_TOKEN':'not-a-real-token',LINT_TEST_MODE:mode,GITHUB_OUTPUT:out,GITHUB_STEP_SUMMARY:summary},encoding:'utf8'});
  assert.equal(r.status,exit,r.stderr);const text=r.stdout+await readFile(out,'utf8')+await readFile(summary,'utf8');assert.ok(!text.includes('private-value'));assert.ok(!text.includes('not-a-real-token'));assert.ok(text.includes('ref=gha'));assert.ok(text.includes('badge.svg'));assert.ok(text.includes('14 days free for founding sellers'));
 }finally{assert.ok(dir.startsWith(resolve('.test-')));await rm(dir,{recursive:true,force:true});}
});
