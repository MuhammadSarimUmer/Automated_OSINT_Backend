const mongoose = require('mongoose');

const alertSchema = new mongoose.Schema({
    targetId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'Target',
        required: true,
        index: true
    },
    source: {
        type: String,
        enum: ['GITHUB', 'SHODAN', 'HIBP'],
        required: true
    },
    severity: {
        type: String,
        enum: ['LOW', 'MEDIUM', 'HIGH', 'CRITICAL'],
        required: true
    },
    description: {
        type: String,
        required: true
    },
    rawUrl: {
        type: String
    },
    isResolved: {
        type: Boolean,
        default: false
    }
}, {
    timestamps: true
});

module.exports = mongoose.model('Alert', alertSchema);