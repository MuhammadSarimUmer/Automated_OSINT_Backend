const Alert = require('../models/alert.model');
const Target = require('../models/target.model');
const githubScanner = require('../services/githubScanner');
const shodanScanner = require('../services/shodanScanner');

exports.getAlerts = async (req, res, next) => {
    try {
        const targets = await Target.find({ userId: req.user.id }).select('_id');
        const targetIds = targets.map(t => t._id);

        const alerts = await Alert.find({ targetId: { $in: targetIds } })
            .populate('targetId', 'targetValue type')
            .sort('-createdAt');

        res.status(200).json({ success: true, count: alerts.length, data: alerts });
    } catch (error) {
        next(error);
    }
};

exports.getStats = async (req, res, next) => {
    try {
        const targets = await Target.find({ userId: req.user.id }).select('_id');
        const targetIds = targets.map(t => t._id);

        const stats = await Alert.aggregate([
            { $match: { targetId: { $in: targetIds } } },
            { $group: { _id: '$severity', count: { $sum: 1 } } }
        ]);

        res.status(200).json({ success: true, data: stats });
    } catch (error) {
        next(error);
    }
};

exports.manualScan = async (req, res, next) => {
    try {
        const target = await Target.findOne({ _id: req.params.targetId, userId: req.user.id });
        if (!target) {
            return res.status(404).json({ success: false, message: 'Target not found' });
        }

        if (target.type === 'DOMAIN' || target.type === 'KEYWORD') {
            await githubScanner.scan(target);
        }
        if (target.type === 'DOMAIN') {
            await shodanScanner.scan(target);
        }

        target.lastScannedAt = Date.now();
        await target.save();

        res.status(200).json({ success: true, message: 'Manual scan triggered successfully' });
    } catch (error) {
        next(error);
    }
};