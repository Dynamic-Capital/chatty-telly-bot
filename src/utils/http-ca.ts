import { readFileSync } from 'fs';
import { Agent } from 'https';
import process from 'node:process';

const extraCa = process.env.NODE_EXTRA_CA_CERTS;
export const httpsAgent = extraCa ? new Agent({ ca: readFileSync(extraCa) }) : new Agent();
