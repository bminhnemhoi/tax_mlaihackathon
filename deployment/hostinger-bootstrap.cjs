/* Passenger startup for a locally built Next standalone bundle + Linux dependencies. */
const path = require('node:path');
const fs = require('node:fs');
const appRoot = path.resolve(__dirname, '..');
const envFile = process.env.TAX_REFEREE_ENV_FILE || path.resolve(appRoot, '../../../config/.env');
if (fs.existsSync(envFile)) process.loadEnvFile(envFile);
const runtime = path.resolve(appRoot, '../../../../runtime');
process.env.NODE_ENV = 'production';
process.env.HOSTNAME = '0.0.0.0';
process.env.UV_THREADPOOL_SIZE ||= '2';
process.env.TAX_REFEREE_DATA_DIR ||= runtime;
process.env.TAX_REFEREE_DB_PATH ||= path.join(runtime, 'tax-referee.sqlite');
process.env.PATH = '/opt/alt/python311/bin:' + process.env.PATH;
process.env.PYTHONPATH = path.join(runtime, 'python') + (process.env.PYTHONPATH ? ':' + process.env.PYTHONPATH : '');
require(path.join(appRoot, '.next/standalone/server.js'));
