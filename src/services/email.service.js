const nodemailer = require('nodemailer');
require('dotenv').config();

const transporter = nodemailer.createTransport({
    service: 'gmail',
    auth: {
        type: 'OAuth2',
        user: process.env.EMAIL_USER,
        clientId: process.env.CLIENT_ID,
        clientSecret: process.env.CLIENT_SECRET,
        refreshToken: process.env.REFRESH_TOKEN,
    },
});

transporter.verify((error) => {
    if (error) {
        console.error('Email Server Error:', error);
    } else {
        console.log('OSINT Email Service Ready');
    }
});

const sendEmail = async (to, subject, html) => {
    try {
        await transporter.sendMail({
            from: `"OSINT Aggregator" <${process.env.EMAIL_USER}>`,
            to,
            subject,
            html,
        });
    } catch (error) {
        console.error('Failed to send OSINT email:', error);
    }
};

/**
 * Sends a welcome email to new investigators/users
 */
async function sendRegistrationEmail(userEmail, name) {
    const subject = 'Welcome to the OSINT Aggregator 🕵️‍♂️';

    const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a; padding: 50px 0; width: 100%; color: #f8fafc;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #1e293b; border-radius: 12px; overflow: hidden; border: 1px solid #334155;">
            <tr>
                <td style="background-color: #6366f1; padding: 40px 0; text-align: center;">
                    <h1 style="color: #ffffff; margin: 0; letter-spacing: 2px; text-transform: uppercase;">OSINT Aggregator</h1>
                    <p style="color: #e2e8f0; margin-top: 5px;">Intelligence System Active</p>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px; color: #cbd5e1; line-height: 1.8;">
                    <h2 style="color: #ffffff; margin-top: 0;">Access Granted, ${name}.</h2>
                    <p>Your account on the Threat Intelligence platform is now active. You can start monitoring domains, keywords, and IPs for potential leaks.</p>
                    
                    <div style="text-align: center; margin: 35px 0;">
                        <a href="${process.env.CLIENT_URL || '#'}" 
                           style="background-color: #6366f1; color: white; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                           Enter Dashboard
                        </a>
                    </div>
                    
                    <p>System monitoring will run every 6 hours. You will receive an email if a critical threat is detected.</p>
                    <p style="margin-bottom: 0;">Stay Secure,<br>System Administrator</p>
                </td>
            </tr>
            <tr>
                <td style="background-color: #0f172a; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
                    <p style="margin: 0;">&copy; 2026 OSINT Aggregator • Intelligence Division</p>
                </td>
            </tr>
        </table>
    </div>
    `;

    await sendEmail(userEmail, subject, html);
}

/**
 * Sends a high-priority alert when a leak is detected
 */
async function sendAlertEmail(userEmail, alertData) {
    const { severity, source, description, rawUrl } = alertData;
    const severityColor = severity === 'CRITICAL' ? '#ef4444' : '#f59e0b';
    const subject = `🚨 ${severity} ALERT: Data Leak Detected via ${source}`;

    const html = `
    <div style="font-family: 'Helvetica Neue', Arial, sans-serif; background-color: #0f172a; padding: 50px 0; width: 100%; color: #f8fafc;">
        <table align="center" border="0" cellpadding="0" cellspacing="0" width="600" style="background-color: #1e293b; border-radius: 12px; overflow: hidden; border: 2px solid ${severityColor};">
            <tr>
                <td style="background-color: ${severityColor}; padding: 30px 0; text-align: center;">
                    <h2 style="color: #ffffff; margin: 0; text-transform: uppercase;">Threat Detected</h2>
                </td>
            </tr>
            <tr>
                <td style="padding: 40px; color: #cbd5e1; line-height: 1.8;">
                    <p style="font-size: 16px;">The automated scanner has detected a potential exposure on <strong>${source}</strong>.</p>
                    
                    <div style="background-color: #0f172a; border-left: 4px solid ${severityColor}; padding: 20px; margin: 25px 0;">
                        <p style="margin: 0; color: #94a3b8; font-size: 12px; text-transform: uppercase;">Security Incident Details</p>
                        <p style="margin: 10px 0; color: #f8fafc;"><strong>Issue:</strong> ${description}</p>
                        <p style="margin: 0; color: #f8fafc;"><strong>Severity:</strong> <span style="color: ${severityColor};">${severity}</span></p>
                    </div>

                    <div style="text-align: center; margin: 35px 0;">
                        <a href="${rawUrl || '#'}" 
                           style="background-color: #ffffff; color: #0f172a; padding: 14px 28px; text-decoration: none; border-radius: 6px; font-weight: bold; display: inline-block;">
                           Investigate Source
                        </a>
                    </div>
                    
                    <p style="font-size: 13px; color: #64748b;">This alert was generated automatically by the Monitoring Service. Please review the raw data to confirm the validity of the leak.</p>
                </td>
            </tr>
            <tr>
                <td style="background-color: #0f172a; padding: 20px; text-align: center; font-size: 12px; color: #64748b;">
                    <p style="margin: 0;">Automated Alert Service • Priority: ${severity}</p>
                </td>
            </tr>
        </table>
    </div>
    `;

    await sendEmail(userEmail, subject, html);
}

module.exports = { sendRegistrationEmail, sendAlertEmail };