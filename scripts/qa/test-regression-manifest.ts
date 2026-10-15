import '../ops/setup-env';
import {runVerification} from '../../services/verificationService';
(async()=>{for(const mode of ['judge','common_4','challenge_a','regression_15']){const r=await runVerification(mode);console.log(`${r.summary.isMatchExpected?'PASS':'FAIL'} ${mode}: ${r.summary.passedCases}/${r.summary.totalCases}`);for(const c of r.results)if(!c.isMatchExpected)console.error(c);if(!r.summary.isMatchExpected)process.exitCode=1;}})().catch(e=>{console.error(e);process.exitCode=1;});
