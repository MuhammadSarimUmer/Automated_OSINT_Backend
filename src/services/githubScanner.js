const { githubApi } = require('../config/externalApis');
const Alert = require('../models/alert.model');
const User = require('../models/user.model');
const { sendAlertEmail } = require('./email.service');

exports.scan = async (target) => {
    try {
        const query = `${target.targetValue} in:file`;
        const response = await githubApi.get(`/search/code?q=${encodeURIComponent(query)}`);

        if (response.data && response.data.items && response.data.items.length > 0) {
            for (let item of response.data.items) {

                const existingAlert = await Alert.findOne({ rawUrl: item.html_url });

                if (!existingAlert) {
                    const alert = await Alert.create({
                        targetId: target._id,
                        source: 'GITHUB',
                        severity: 'HIGH',
                        description: `Sensitive target found in repository: ${item.repository.full_name}`,
                        rawUrl: item.html_url
                    });


                    const user = await User.findById(target.userId);
                    if (user) {
                        await sendAlertEmail(user.email, alert);
                    }
                }
            }
        }
    } catch (error) {
        console.error(`GitHub Scanner Error for ${target.targetValue}:`, error.message);
    }
};