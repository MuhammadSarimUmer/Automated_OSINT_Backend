const { shodanApi } = require('../config/externalApis');
const Alert = require('../models/alert.model');
const User = require('../models/user.model');
const { sendAlertEmail } = require('./email.service');

exports.scan = async (target) => {
    try {
        const response = await shodanApi.get('/shodan/host/search', {
            params: { query: `hostname:${target.targetValue}` }
        });

        if (response.data && response.data.matches && response.data.matches.length > 0) {
            for (let match of response.data.matches) {

                const rawUrl = `https://www.shodan.io/host/${match.ip_str}`;
                const existingAlert = await Alert.findOne({ rawUrl });

                if (!existingAlert) {
                    const isCritical = [27017, 3306, 21, 23].includes(match.port);

                    const alert = await Alert.create({
                        targetId: target._id,
                        source: 'SHODAN',
                        severity: isCritical ? 'CRITICAL' : 'MEDIUM',
                        description: `Open port ${match.port} found on IP ${match.ip_str}`,
                        rawUrl
                    });

                    if (isCritical) {

                        const user = await User.findById(target.userId);
                        if (user) {
                            await sendAlertEmail(user.email, alert);
                        }
                    }
                }
            }
        }
    } catch (error) {
        console.error(`Shodan Scanner Error for ${target.targetValue}:`, error.message);
    }
};