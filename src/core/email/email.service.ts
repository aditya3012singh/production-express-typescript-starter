import nodemailer, { Transporter } from 'nodemailer';
import env from '../config/env.js';
import logger from '../logger/structuredLogger.js';

interface SendEmailOptions {
    to: string;
    subject: string;
    text?: string;
    html?: string;
}

class EmailService {
    static transporter: Transporter | null = null;

    /**
     * Initialize Nodemailer Transporter
     */
    static getTransporter(): Transporter | null {
        if (this.transporter) {
            return this.transporter;
        }

        const isProd = env.NODE_ENV === 'production';
        const hasSmtpConfig = env.SMTP_HOST && env.SMTP_USER && env.SMTP_PASS;

        if (hasSmtpConfig) {
            logger.info('[EmailService] 📧 Initializing SMTP transporter...');
            this.transporter = nodemailer.createTransport({
                host: env.SMTP_HOST,
                port: env.SMTP_PORT || 587,
                secure: env.SMTP_PORT === 465, // true for 465, false for other ports
                auth: {
                    user: env.SMTP_USER,
                    pass: env.SMTP_PASS,
                },
            });
        } else {
            if (isProd) {
                logger.error('[EmailService] ❌ Missing SMTP credentials in production!');
            } else {
                logger.info('[EmailService] ℹ️ SMTP credentials missing. Using Console Log Mock Mode.');
            }
        }

        return this.transporter;
    }

    /**
     * Send email
     */
    static async sendEmail({ to, subject, text, html }: SendEmailOptions): Promise<any> {
        const mailOptions = {
            from: env.EMAIL_FROM,
            to,
            subject,
            text,
            html,
        };

        const transporter = this.getTransporter();

        if (transporter) {
            try {
                const info = await transporter.sendMail(mailOptions);
                logger.info(`[EmailService] ✅ Email sent to ${to}: ${info.messageId}`);
                return info;
            } catch (error) {
                logger.error(`[EmailService] ❌ Failed to send email to ${to}:`, error);
                throw error;
            }
        } else {
            // Mock mode for local dev (Log to Console)
            logger.info(`\n======================================================`);
            logger.info(`📧 [EMAIL MOCK] Sending Email`);
            logger.info(`From:    ${mailOptions.from}`);
            logger.info(`To:      ${mailOptions.to}`);
            logger.info(`Subject: ${mailOptions.subject}`);
            if (mailOptions.text) logger.info(`Text:    ${mailOptions.text}`);
            if (mailOptions.html) logger.info(`HTML:    ${mailOptions.html}`);
            logger.info(`======================================================\n`);
            
            return { mock: true, messageId: `mock_${Date.now()}` };
        }
    }
}

export default EmailService;
