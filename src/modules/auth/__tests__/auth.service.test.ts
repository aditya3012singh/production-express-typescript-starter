import { describe, it, expect, vi } from 'vitest';
import { mockPrisma } from '../../../__tests__/helpers/prisma.mock.js';
import AuthService from '../auth.service.js';
import EmailService from '../../../core/email/email.service.js';

// Mock the email service
vi.mock('../../../core/email/email.service.js', () => ({
  default: {
    sendEmail: vi.fn().mockResolvedValue({ success: true })
  }
}));

describe('AuthService', () => {
  describe('forgotPasswordService', () => {
    it('should return safe message even if user does not exist (prevention of email discovery)', async () => {
      // Stub findUnique to return null (no user found)
      mockPrisma.user.findUnique.mockResolvedValue(null);

      const result = await AuthService.forgotPasswordService('nonexistent@example.com');
      
      expect(result.message).toContain('If an account with that email exists');
      expect(result.devTokenHint).toBeUndefined();
    });

    it('should generate reset token and call EmailService if user exists', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        password: 'hashed-password',
        role: 'USER' as any,
        profilePic: null,
        linkedin: null,
        github: null,
        refreshTokenHash: null,
        tokenVersion: 0,
        resetPasswordToken: null,
        resetPasswordExpires: null,
        createdAt: new Date(),
        updatedAt: new Date(),
        loginAttempts: 0,
        lockUntil: null
      };

      mockPrisma.user.findUnique.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await AuthService.forgotPasswordService('test@example.com');

      expect(result.message).toContain('If an account with that email exists');
      expect(result.devTokenHint).toBeDefined(); // Since NODE_ENV defaults to test/development
      expect(EmailService.sendEmail).toHaveBeenCalled();
    });
  });

  describe('resetPasswordService', () => {
    it('should throw bad request error if token is invalid or expired', async () => {
      mockPrisma.user.findFirst.mockResolvedValue(null);

      await expect(
        AuthService.resetPasswordService('invalid-token', 'newPassword123')
      ).rejects.toThrow('Token is invalid or has expired.');
    });

    it('should update user password and reset token on success', async () => {
      const mockUser = {
        id: 'user-123',
        email: 'test@example.com',
        username: 'testuser',
        password: 'old-hashed-password',
        role: 'USER' as any,
        profilePic: null,
        linkedin: null,
        github: null,
        refreshTokenHash: null,
        tokenVersion: 0,
        resetPasswordToken: 'hashed-token',
        resetPasswordExpires: new Date(Date.now() + 10000),
        createdAt: new Date(),
        updatedAt: new Date(),
        loginAttempts: 0,
        lockUntil: null
      };

      mockPrisma.user.findFirst.mockResolvedValue(mockUser);
      mockPrisma.user.update.mockResolvedValue(mockUser);

      const result = await AuthService.resetPasswordService('valid-token', 'newPassword123');

      expect(result.message).toContain('Password has been successfully reset.');
      expect(mockPrisma.user.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'user-123' },
          data: expect.objectContaining({
            resetPasswordToken: null,
            resetPasswordExpires: null
          })
        })
      );
    });
  });
});
