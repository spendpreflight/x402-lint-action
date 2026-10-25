// Child-process integration fixture only; the shipped runtime does not import this.
globalThis.fetch=async(url,init)=>{
 if(url!=='https://api.spendpreflight.com/v1/lint?ref=gha'||init.method!=='POST')throw Error('Unexpected test network request');
 const findings=process.env.LINT_TEST_MODE==='error'?[{level:'error',code:'invalid_network'}]:[];
 return Response.json({id:'11111111-1111-4111-8111-111111111111',expires_at:new Date(Date.now()+86400000).toISOString(),outcome:process.env.LINT_TEST_MODE==='unknown'?'inconclusive':findings.length?'issues_found':'challenge_observed',http_status:402,challenge_shape_valid:true,resource_matches:true,listingGuard:{riskScore:0},findings});
};
