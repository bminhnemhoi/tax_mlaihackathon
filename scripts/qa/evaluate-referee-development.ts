import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import {execFileSync} from 'node:child_process';
import {developmentCases,developmentCompanyTaxCode} from '../../data/verification/developmentCases';
import {evaluateRefereeCases} from '../../services/refereeEvaluationService';
import {getActivePolicy,runIsolated,hashPayload} from '../../lib/server/db';
import {sourceMetadata,writeReport} from './referee-report-utils';
async function main():Promise<void>{
  const output=process.argv.slice(2).find(arg=>!arg.startsWith('--'));
  const policy=await runIsolated(async()=>{const p=getActivePolicy();p.config.companyTaxCode=developmentCompanyTaxCode;return p;});
  const report={runId:crypto.randomUUID(),timestamp:new Date().toISOString(),dataset:'SYNTHETIC_DEVELOPMENT',fixtureHash:hashPayload(developmentCases),
    ...sourceMetadata(),
    ...await evaluateRefereeCases(developmentCases,policy)};
  if(output)writeReport(report,output);
  console.log(JSON.stringify({total:report.total,passed:report.passed,errors:report.errors,falseNegative:report.falseNegative,falsePositive:report.falsePositive,failed:report.results.filter(r=>!r.match).map(r=>({id:r.id,actual:r.actual,...('actualRiskGroup' in r?{group:r.actualRiskGroup}:{}),...('error' in r?{error:r.error}:{})}))},null,2));
  if(process.argv.includes('--assert') && report.passed!==report.total)process.exitCode=1;
}
main().catch(error=>{console.error(error);process.exitCode=1;});
