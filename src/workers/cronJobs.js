const cron = require('node-cron');
const Target = require('../models/target.model');
const githubScanner = require('../services/githubScanner');
const shodanScanner = require('../services/shodanScanner');

const runScanners = async () => {
    console.log('[CRON] Starting automated OSINT scans...');
    try {
        const targets = await Target.find({ isActive: true });

        for (let target of targets) {
            if (target.type === 'DOMAIN' || target.type === 'KEYWORD') {
                await githubScanner.scan(target);
            }
            if (target.type === 'DOMAIN') {
                await shodanScanner.scan(target);
            }

            target.lastScannedAt = Date.now();
            await target.save();
        }
        console.log('[CRON] Automated scans completed successfully.');
    } catch (error) {
        console.error('[CRON] Error running automated scans:', error.message);
    }
};

const initCronJobs = () => {
    cron.schedule('0 */6 * * *', runScanners);
    console.log('Cron jobs initialized: OSINT Scanner scheduled to run every 6 hours.');
};

module.exports = initCronJobs;