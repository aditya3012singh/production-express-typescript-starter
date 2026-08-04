import crypto from 'crypto';
import bcrypt from 'bcrypt';
import DBWrapper from '../../core/config/db.wrapper.js';
import env from '../../core/config/env.js';
import EmailService from '../../core/email/email.service.js';

interface ForgotPasswordResult {
    message: string;
    devTokenHint?: string;
}

interface ResetPasswordResult {
    message: string;
}

class AuthService {
    /**
     * Generate password reset token and send instructions email
     */
    static async forgotPasswordService(email: string): Promise<ForgotPasswordResult> {
        const user = await DBWrapper.execute('authForgotGetUser', (db) =>
            db.user.findUnique({ where: { email } })
        );

        if (!user) {
            // Safe fallback response to prevent email discovery attacks
            return { message: 'If an account with that email exists, a reset link has been sent.' };
        }

        // Generate clean token and its hash representation for DB persistence
        const resetToken = crypto.randomBytes(32).toString('hex');
        const hashedToken = crypto.createHash('sha256').update(resetToken).digest('hex');

        // Expiry time set to 15 minutes
        const tokenExpiry = new Date(Date.now() + 15 * 60 * 1000);

        await DBWrapper.execute('authForgotSetResetToken', (db) =>
            db.user.update({
                where: { email },
                data: {
                    resetPasswordToken: hashedToken,
                    resetPasswordExpires: tokenExpiry
                }
            })
        );

        // Send reset email asynchronously using EmailService
        const baseUrl = env.FRONTEND_URL.endsWith('/') ? env.FRONTEND_URL.slice(0, -1) : env.FRONTEND_URL;
        const resetUrl = `${baseUrl}/reset-password/${resetToken}`;

        await EmailService.sendEmail({
            to: email,
            subject: 'Reset your password',
            text: `Click this link to reset your password: ${resetUrl}`,
            html: `<p>You requested a password reset. Click <a href="${resetUrl}">here</a> to reset your password.</p>`
        });

        const result: ForgotPasswordResult = {
            message: 'If an account with that email exists, a reset link has been sent.'
        };

        if (env.NODE_ENV !== 'production') {
            result.devTokenHint = resetToken;
        }

        return result;
    }

    /**
     * Verify token and reset password in database
     */
    static async resetPasswordService(token: string, newPassword: string): Promise<ResetPasswordResult> {
        const hashedToken = crypto.createHash('sha256').update(token).digest('hex');

        const user = await DBWrapper.execute('authResetGetByToken', (db) =>
            db.user.findFirst({
                where: {
                    resetPasswordToken: hashedToken,
                    resetPasswordExpires: { gte: new Date() }
                }
            })
        );

        if (!user) {
            const err = new Error('Token is invalid or has expired.');
            (err as any).statusCode = 400;
            throw err;
        }

        const hashedPassword = await bcrypt.hash(newPassword, 12);

        await DBWrapper.execute('authResetUpdatePassword', (db) =>
            db.user.update({
                where: { id: user.id },
                data: {
                    password: hashedPassword,
                    resetPasswordToken: null,
                    resetPasswordExpires: null
                }
            })
        );

        return { message: 'Password has been successfully reset.' };
    }
}

export default AuthService;
