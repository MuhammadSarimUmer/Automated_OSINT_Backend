const Target = require('../models/target.model');

exports.addTarget = async (req, res, next) => {
    try {
        const { targetValue, type } = req.body;
        const target = await Target.create({
            userId: req.user.id,
            targetValue,
            type
        });
        res.status(201).json({ success: true, data: target });
    } catch (error) {
        next(error);
    }
};

exports.getTargets = async (req, res, next) => {
    try {
        const targets = await Target.find({ userId: req.user.id });
        res.status(200).json({ success: true, count: targets.length, data: targets });
    } catch (error) {
        next(error);
    }
};

exports.deleteTarget = async (req, res, next) => {
    try {
        const target = await Target.findOneAndDelete({ _id: req.params.id, userId: req.user.id });
        if (!target) {
            return res.status(404).json({ success: false, message: 'Target not found' });
        }
        res.status(200).json({ success: true, data: {} });
    } catch (error) {
        next(error);
    }
};