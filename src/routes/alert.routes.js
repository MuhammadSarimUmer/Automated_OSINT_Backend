const express = require('express');
const { getAlerts, getStats, manualScan } = require('../controllers/alert.controller');
const authMiddleware = require('../middlewares/auth.middleware');

const router = express.Router();

router.use(authMiddleware);

router.get('/', getAlerts);
router.get('/stats', getStats);
router.post('/manual-scan/:targetId', manualScan);

module.exports = router;