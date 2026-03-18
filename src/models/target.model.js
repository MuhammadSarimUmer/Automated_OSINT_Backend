const mongoose = require('mongoose');

const targetSchema = new mongoose.Schema({
    userId: {
        type: mongoose.Schema.Types.ObjectId,
        ref: 'User',
        required: true,
        index: true
    },
    targetValue: {
        type: String,
        required: true,
        trim: true
    },
    type: {
        type: String,
        enum: ['DOMAIN', 'EMAIL', 'KEYWORD'],
        required: true
    },
    lastScannedAt: {
        type: Date,
        default: null
    },
    isActive: {
        type: Boolean,
        default: true
    }
}, {
    timestamps: true
});

targetSchema.index({ userId: 1, targetValue: 1 }, { unique: true });

module.exports = mongoose.model('Target', targetSchema);