import { NextFunction, Request, Response } from 'express';
import bcrypt from 'bcrypt';
import jwt from 'jsonwebtoken';
import env from '../../core/config/env.js';
import DBWrapper from '../../core/config/db.wrapper.js';
import UserCache from '../../core/cache/userCache.js';
import CacheManager from '../../core/cache/cacheManager.js';
import S3Service from '../../integrations/s3/s3.service.js';
import AuthService from './auth.service.js';
import dualModeEventBus from '../../core/events/dualModeEventBus.js';
import { EventTypes } from '../../core/events/eventTypes.js';
import { registerSchema, loginSchema, updateProfileSchema } from './auth.schema.js';
import { TracedRequest } from '../../api/middleware/traceId.middleware.js';
import { FormattedResponse } from '../../api/middleware/responseFormatter.js';

const COOKIE_OPTIONS = {
    httpOnly: true,
    secure: env.NODE_ENV === 'production',
    sameSite: 'lax' as const,
    maxAge: 7 * 24 * 60 * 60 * 1000 // 7 days in milliseconds
};

class AuthController {
    /**
     * User registration handler
     */
    static async register(req: Request, res: FormattedResponse, next: NextFunction): Promise<void> {
        try {
            const body = registerSchema.parse(req.body);

            const hashedPassword = await bcrypt.hash(body.password, 12);

            const user = await DBWrapper.execute('authRegisterUser', async (db) => {
                const existing = await db.user.findFirst({
                    where: { OR: [{ email: body.email }, { username: body.username }] }
                });

                if (existing) {
                    const err = new Error('Username or email is already registered.');
                    (err as any).statusCode = 409;
                    throw err;
                }

                return db.user.create({
                    data: {
                        username: body.username,
                        email: body.email,
                        password: hashedPassword
                    },
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        role: true,
                        createdAt: true
                    }
                });
            });

            // Emit registration event
            await dualModeEventBus.emitEvent(EventTypes.USER_REGISTERED, {
                userId: user.id,
                email: user.email,
                username: user.username
            });

            res.created?.(user, 'User registered successfully.');
        } catch (error) {
            next(error);
        }
    }

    /**
     * User login handler with account lock protection
     */
    static async login(req: Request, res: FormattedResponse, next: NextFunction): Promise<void> {
        try {
            const body = loginSchema.parse(req.body);

            const user = await DBWrapper.execute('authFindUserForLogin', (db) =>
                db.user.findUnique({
                    where: { email: body.email }
                })
            );

            if (!user) {
                const err = new Error('Invalid email or password.');
                (err as any).statusCode = 401;
                throw err;
            }

            // Check lock status
            if (user.lockUntil && user.lockUntil > new Date()) {
                const timeDiff = Math.ceil((user.lockUntil.getTime() - Date.now()) / 60000);
                const err = new Error(`Account locked. Try again in ${timeDiff} minutes.`);
                (err as any).statusCode = 423;
                throw err;
            }

            const isPasswordValid = await bcrypt.compare(body.password, user.password);

            if (!isPasswordValid) {
                // Increment failed attempts
                await DBWrapper.execute('authIncrementFailedAttempts', (db) => {
                    const attempts = user.loginAttempts + 1;
                    const lockTime = attempts >= 5 ? new Date(Date.now() + 15 * 60 * 1000) : null; // 15 mins lock

                    return db.user.update({
                        where: { id: user.id },
                        data: {
                            loginAttempts: attempts,
                            ...(lockTime ? { lockUntil: lockTime } : {})
                        }
                    });
                });

                const err = new Error('Invalid email or password.');
                (err as any).statusCode = 401;
                throw err;
            }

            // Generate tokens
            const accessToken = jwt.sign(
                { id: user.id, role: user.role },
                env.JWT_ACCESS_SECRET,
                { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any }
            );

            const refreshToken = jwt.sign(
                { id: user.id, tokenVersion: user.tokenVersion },
                env.JWT_REFRESH_SECRET,
                { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
            );

            const refreshTokenHash = await bcrypt.hash(refreshToken, 10);

            // Save token hash & reset locks
            await DBWrapper.execute('authUpdateTokensAndResetAttempts', (db) =>
                db.user.update({
                    where: { id: user.id },
                    data: {
                        refreshTokenHash,
                        loginAttempts: 0,
                        lockUntil: null
                    }
                })
            );

            // Register cookies
            res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

            // Emit authentication event
            await dualModeEventBus.emitEvent(EventTypes.USER_AUTHENTICATED, {
                userId: user.id,
                ip: req.ip,
                userAgent: req.get('user-agent')
            });

            res.ok?.({
                user: {
                    id: user.id,
                    username: user.username,
                    email: user.email,
                    role: user.role
                },
                accessToken
            }, 'Logged in successfully.');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Refresh Token Rotation & Conflict Resolution
     */
    static async refresh(req: Request, res: FormattedResponse, next: NextFunction): Promise<void> {
        try {
            const refreshToken = req.cookies.refreshToken;
            if (!refreshToken) {
                const err = new Error('No refresh token provided.');
                (err as any).statusCode = 401;
                throw err;
            }

            let decoded: any;
            try {
                decoded = jwt.verify(refreshToken, env.JWT_REFRESH_SECRET);
            } catch (err: any) {
                const error = new Error('Invalid or expired refresh token.');
                (error as any).statusCode = 401;
                throw error;
            }

            const user = await DBWrapper.execute('authFindUserForRefresh', (db) =>
                db.user.findUnique({
                    where: { id: decoded.id }
                })
            );

            if (!user || !user.refreshTokenHash) {
                const err = new Error('Session not found.');
                (err as any).statusCode = 401;
                throw err;
            }

            // Verify hash match
            const isMatch = await bcrypt.compare(refreshToken, user.refreshTokenHash);

            if (!isMatch) {
                // Invalidate all user sessions
                await DBWrapper.execute('authInvalidateAllSessionsOnConflict', (db) =>
                    db.user.update({
                        where: { id: user.id },
                        data: {
                            refreshTokenHash: null,
                            tokenVersion: { increment: 1 }
                        }
                    })
                );

                res.clearCookie('refreshToken', COOKIE_OPTIONS);
                const err = new Error('Security alert: Refresh token reuse detected. All sessions terminated.');
                (err as any).statusCode = 403;
                throw err;
            }

            // Rotate tokens
            const accessToken = jwt.sign(
                { id: user.id, role: user.role },
                env.JWT_ACCESS_SECRET,
                { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any }
            );

            const newRefreshToken = jwt.sign(
                { id: user.id, tokenVersion: user.tokenVersion },
                env.JWT_REFRESH_SECRET,
                { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
            );

            const newRefreshTokenHash = await bcrypt.hash(newRefreshToken, 10);

            await DBWrapper.execute('authUpdateNewRefreshToken', (db) =>
                db.user.update({
                    where: { id: user.id },
                    data: { refreshTokenHash: newRefreshTokenHash }
                })
            );

            res.cookie('refreshToken', newRefreshToken, COOKIE_OPTIONS);

            res.ok?.({ accessToken }, 'Session refreshed successfully.');
        } catch (error) {
            next(error);
        }
    }

    /**
     * User logout handler
     */
    static async logout(req: TracedRequest, res: FormattedResponse, next: NextFunction): Promise<void> {
        try {
            const userId = req.userId;

            if (userId) {
                await DBWrapper.execute('authLogoutClearHash', (db) =>
                    db.user.update({
                        where: { id: userId },
                        data: { refreshTokenHash: null }
                    })
                );
            }

            res.clearCookie('refreshToken', COOKIE_OPTIONS);
            res.ok?.({}, 'Logged out successfully.');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user profile details
     */
    static async getProfile(req: TracedRequest, res: FormattedResponse, next: NextFunction): Promise<void> {
        try {
            const userId = req.userId;
            if (!userId) {
                const err = new Error('Unauthorized');
                (err as any).statusCode = 401;
                throw err;
            }

            const user = await UserCache.get(userId);

            if (!user) {
                const err = new Error('User profile not found.');
                (err as any).statusCode = 404;
                throw err;
            }

            res.ok?.({ user }, 'User profile fetched successfully.');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get user public profile details
     */
    static async getPublicProfile(req: Request, res: FormattedResponse, next: NextFunction): Promise<void> {
        try {
            const username = req.params.username as string;

            const user = await DBWrapper.execute('authGetPublicProfile', (db) =>
                db.user.findUnique({
                    where: { username },
                    select: {
                        id: true,
                        username: true,
                        role: true,
                        createdAt: true,
                        profilePic: true,
                        linkedin: true,
                        github: true
                    }
                })
            );

            if (!user) {
                const err = new Error('User not found.');
                (err as any).statusCode = 404;
                throw err;
            }

            res.ok?.({ user }, 'Public profile fetched successfully.');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update user profile settings
     */
    static async updateProfile(req: TracedRequest, res: FormattedResponse, next: NextFunction): Promise<void> {
        try {
            const userId = req.userId;
            if (!userId) {
                const err = new Error('Unauthorized');
                (err as any).statusCode = 401;
                throw err;
            }

            const updateData = updateProfileSchema.parse(req.body);

            const allowedFields: Array<keyof typeof updateData> = ['profilePic', 'linkedin', 'github'];
            const dataToUpdate: Record<string, any> = {};

            for (const field of allowedFields) {
                if (updateData[field] !== undefined) {
                    dataToUpdate[field] = updateData[field];
                }
            }

            const updatedUser = await DBWrapper.execute('authUpdateProfileFields', (db) =>
                db.user.update({
                    where: { id: userId },
                    data: dataToUpdate,
                    select: {
                        id: true,
                        username: true,
                        email: true,
                        profilePic: true,
                        linkedin: true,
                        github: true
                    }
                })
            );

            await CacheManager.handleUserUpdate(userId);

            res.ok?.({ user: updatedUser }, 'Profile settings updated successfully.');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Get presigned URL for profile picture upload
     */
    static async getProfileUploadUrl(req: TracedRequest, res: FormattedResponse, next: NextFunction): Promise<void> {
        try {
            const userId = req.userId;
            if (!userId) {
                const err = new Error('Unauthorized');
                (err as any).statusCode = 401;
                throw err;
            }

            const fileName = req.query.fileName as string | undefined;
            const fileType = req.query.fileType as string | undefined;

            if (!fileName || !fileType) {
                const err = new Error('fileName and fileType are required query parameters.');
                (err as any).statusCode = 400;
                throw err;
            }

            const extension = fileName.split('.').pop();
            const key = `avatars/${userId}_${Date.now()}.${extension}`;

            const { uploadUrl, fileUrl } = await S3Service.getPresignedUrl(key, fileType);

            res.ok?.({ uploadUrl, fileUrl }, 'Upload URL generated successfully.');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Trigger password reset instructions
     */
    static async forgotPassword(req: Request, res: FormattedResponse, next: NextFunction): Promise<void> {
        try {
            const { email } = req.body;
            if (!email) {
                const err = new Error('Email is required.');
                (err as any).statusCode = 400;
                throw err;
            }

            const result = await AuthService.forgotPasswordService(email);
            res.ok?.(result, 'Reset instructions processed.');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Execute password reset using verification token
     */
    static async resetPassword(req: Request, res: FormattedResponse, next: NextFunction): Promise<void> {
        try {
            const token = req.params.token || req.body.token;
            const { newPassword } = req.body;

            if (!token || !newPassword) {
                const err = new Error('Token and newPassword are required parameters.');
                (err as any).statusCode = 400;
                throw err;
            }

            const result = await AuthService.resetPasswordService(token, newPassword);
            res.ok?.(result, 'Password reset successfully.');
        } catch (error) {
            next(error);
        }
    }

    /**
     * Update account password (authenticated)
     */
    static async changePassword(req: TracedRequest, res: FormattedResponse, next: NextFunction): Promise<void> {
        try {
            const userId = req.userId;
            if (!userId) {
                const err = new Error('Unauthorized');
                (err as any).statusCode = 401;
                throw err;
            }

            const { oldPassword, newPassword } = req.body;
            if (!oldPassword || !newPassword) {
                const err = new Error('oldPassword and newPassword are required.');
                (err as any).statusCode = 400;
                throw err;
            }

            const user = await DBWrapper.execute('authChangePasswordGetUser', (db) =>
                db.user.findUnique({ where: { id: userId } })
            );

            if (!user) {
                const err = new Error('User not found.');
                (err as any).statusCode = 404;
                throw err;
            }

            if (!user.password) {
                const err = new Error('OAuth accounts must use their provider to log in or reset password via email.');
                (err as any).statusCode = 400;
                throw err;
            }

            const isMatch = await bcrypt.compare(oldPassword, user.password);
            if (!isMatch) {
                const err = new Error('Invalid old password.');
                (err as any).statusCode = 400;
                throw err;
            }

            const hashedPassword = await bcrypt.hash(newPassword, 12);
            await DBWrapper.execute('authChangePasswordUpdate', (db) =>
                db.user.update({
                    where: { id: userId },
                    data: { password: hashedPassword }
                })
            );

            res.ok?.({}, 'Password updated successfully.');
        } catch (error) {
            next(error);
        }
    }

    /**
     * OAuth callback handler
     */
    static async socialAuthCallback(req: Request, res: Response, next: NextFunction): Promise<void> {
        try {
            const user = req.user as any;
            if (!user) {
                res.redirect(`${env.FRONTEND_URL}/login?error=auth_failed`);
                return;
            }

            const accessToken = jwt.sign(
                { id: user.id, role: user.role },
                env.JWT_ACCESS_SECRET,
                { expiresIn: env.JWT_ACCESS_EXPIRES_IN as any }
            );

            const refreshToken = jwt.sign(
                { id: user.id, tokenVersion: user.tokenVersion },
                env.JWT_REFRESH_SECRET,
                { expiresIn: env.JWT_REFRESH_EXPIRES_IN as any }
            );

            const hashedToken = await bcrypt.hash(refreshToken, 10);

            await DBWrapper.execute('authSocialSetRefreshToken', (db) =>
                db.user.update({
                    where: { id: user.id },
                    data: { refreshTokenHash: hashedToken }
                })
            );

            const { state } = req.query as { state?: string };
            let redirectTo = '/';
            if (state) {
                try {
                    const decoded = JSON.parse(Buffer.from(state, 'base64').toString());
                    if (decoded.redirectTo) redirectTo = decoded.redirectTo;
                } catch (e) {
                    console.error('Failed to parse social auth state:', e);
                }
            }

            const baseUrl = env.FRONTEND_URL.endsWith('/') ? env.FRONTEND_URL.slice(0, -1) : env.FRONTEND_URL;
            const targetPath = redirectTo.startsWith('/') ? redirectTo : `/${redirectTo}`;
            const finalUrl = `${baseUrl}${targetPath}${targetPath.includes('?') ? '&' : '?'}accessToken=${encodeURIComponent(accessToken)}&refreshToken=${encodeURIComponent(refreshToken)}&auth_success=true`;

            // Emit authentication event
            await dualModeEventBus.emitEvent(EventTypes.USER_AUTHENTICATED, {
                userId: user.id,
                ip: req.ip,
                userAgent: req.get('user-agent'),
                method: user.googleId ? 'google' : 'github'
            });

            res.cookie('accessToken', accessToken, COOKIE_OPTIONS);
            res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);
            res.redirect(finalUrl);
        } catch (error) {
            console.error('Social auth callback error:', error);
            res.redirect(`${env.FRONTEND_URL}/login?error=server_error`);
        }
    }
}

export default AuthController;
