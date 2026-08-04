import { z } from 'zod';

export const loginSchema = z.object({
    email: z
        .string()
        .min(1, "Email is required")
        .email("Invalid email format"),
    password: z
        .string()
        .min(1, "Password is required"),
});

export const registerSchema = z.object({
    email: z
        .string()
        .min(1, "Email is required")
        .email("Invalid email format"),
    username: z
        .string() 
        .min(3, "Username must be at least 3 characters long")
        .max(30, "Username must be at most 30 characters long"),
    password: z
        .string()
        .min(6, "Password must be at least 6 characters long"),
});

export const forgotPasswordSchema = z.object({
    email: z
        .string()
        .min(1, "Email is required")
        .email("Invalid email format"),
});

export const resetPasswordSchema = z.object({
    token: z.string().min(1, "Token is required"),
    newPassword: z.string().min(6, "Password must be at least 6 characters long"),
});

export const changePasswordSchema = z.object({
    oldPassword: z.string().min(1, "Old password is required"),
    newPassword: z.string().min(6, "New password must be at least 6 characters long"),
});

export const updateProfileSchema = z.object({
    profilePic: z.string().url().nullable().optional(),
    linkedin: z.string().url().nullable().optional(),
    github: z.string().url().nullable().optional()
});
