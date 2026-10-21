/**
 * READ-ONLY check of the e-mail (SMTP) and AWS settings GOG OMS uses.
 *
 *   node scripts/check-email-aws-env.js            → which variables are set (names only, never values)
 *   node scripts/check-email-aws-env.js --verify   → also logs in to the SMTP server (no e-mail is sent)
 *                                                    and checks that the S3 bucket is reachable (nothing is uploaded)
 *
 * Reads .env.local like `next dev` (a system environment variable wins). Never prints a secret.
 */
const path = require('path');
require('dotenv').config({ path: path.join(process.cwd(), '.env.local'), quiet: true });

const GROUPS = {
    'SMTP (e-mails)': ['SMTP_HOST', 'SMTP_PORT', 'SMTP_SECURE', 'SMTP_USER', 'SMTP_PASS'],
    'AWS S3 (documents / photos)': ['AWS_REGION', 'AWS_ACCESS_KEY_ID', 'AWS_SECRET_ACCESS_KEY', 'AWS_BUCKET_NAME'],
    'Other': ['MONGODB_URI', 'CRON_SECRET', 'APP_URL', 'NEXT_PUBLIC_APP_URL'],
};
const OPTIONAL = new Set(['CRON_SECRET', 'APP_URL', 'NEXT_PUBLIC_APP_URL', 'SMTP_SECURE']);
let missing = 0;
console.log('GOG OMS — e-mail / AWS settings (values are never shown)');
for (const [group, vars] of Object.entries(GROUPS)) {
    console.log(`\n${group}`);
    for (const v of vars) {
        const set = !!(process.env[v] && String(process.env[v]).trim());
        if (!set && !OPTIONAL.has(v)) missing++;
        console.log(`  ${set ? '✓' : OPTIONAL.has(v) ? '–' : '✗'} ${v}${set ? '' : OPTIONAL.has(v) ? ' (optional, not set)' : ' — MISSING'}`);
    }
}
if (process.env.SMTP_PORT && !/^\d+$/.test(process.env.SMTP_PORT)) console.log('  ! SMTP_PORT is not a number');
if (process.env.SMTP_SECURE && !['true', 'false'].includes(process.env.SMTP_SECURE)) console.log('  ! SMTP_SECURE should be "true" (port 465) or "false" (port 587)');
if (process.env.SMTP_PORT === '465' && process.env.SMTP_SECURE !== 'true') console.log('  ! Port 465 normally needs SMTP_SECURE=true');

(async () => {
    if (!process.argv.includes('--verify')) { console.log(`\n${missing ? `${missing} required variable(s) missing.` : 'All required variables are set.'} Run with --verify to test the connections.`); return; }
    console.log('\nConnection checks:');
    try {
        const nodemailer = require('nodemailer');
        const t = nodemailer.createTransport({ host: process.env.SMTP_HOST || 'smtp.gmail.com', port: parseInt(process.env.SMTP_PORT || '465'), secure: process.env.SMTP_SECURE === 'true', auth: { user: process.env.SMTP_USER, pass: process.env.SMTP_PASS } });
        await t.verify();
        console.log('  ✓ SMTP: login accepted (no e-mail was sent)');
    } catch (e) { console.log('  ✗ SMTP: ' + String(e.message || e).replace(/pass(word)?[^,]*/ig, 'password ***')); }
    try {
        const { S3Client, HeadBucketCommand } = require('@aws-sdk/client-s3');
        const s3 = new S3Client({ region: process.env.AWS_REGION, credentials: { accessKeyId: process.env.AWS_ACCESS_KEY_ID || '', secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '' } });
        await s3.send(new HeadBucketCommand({ Bucket: process.env.AWS_BUCKET_NAME }));
        console.log('  ✓ AWS S3: bucket reachable with these credentials (nothing uploaded)');
    } catch (e) { console.log('  ✗ AWS S3: ' + (e.name || '') + ' ' + String(e.message || '').slice(0, 160)); }
})();