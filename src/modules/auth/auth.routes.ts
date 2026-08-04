import express, { Request, Response, NextFunction } from "express";
import AuthController from "./auth.controller.js";
import { authenticateJWT } from "../../api/middleware/auth.middleware.js";
import { authRateLimiter } from "../../api/middleware/rateLimiter.js";
import validateRequest from "../../api/middleware/validateRequest.middleware.js";
import {
    loginSchema,
    registerSchema,
    forgotPasswordSchema,
    resetPasswordSchema,
    changePasswordSchema
} from "./auth.schema.js";
import passport from "passport";

const router = express.Router();

// 🔐 Auth routes (Rate limited to block brute-force attempts)
router.post("/login", authRateLimiter, validateRequest(loginSchema), AuthController.login);
router.post("/register", authRateLimiter, validateRequest(registerSchema), AuthController.register);
router.post("/logout", authenticateJWT, AuthController.logout);
router.post("/refresh", AuthController.refresh);

// 🔑 Password Reset Routes
router.post("/change-password", authenticateJWT, validateRequest(changePasswordSchema), AuthController.changePassword);
router.post("/forgot-password", validateRequest(forgotPasswordSchema), AuthController.forgotPassword);
router.post("/reset-password/:token", validateRequest(resetPasswordSchema), AuthController.resetPassword);

// 🖼️ Profile picture presigned R2/S3 upload URL
router.get("/profile/upload-url", authenticateJWT, AuthController.getProfileUploadUrl);

// 👤 Profile view / edit
router.get("/profile", authenticateJWT, AuthController.getProfile);
router.put("/profile", authenticateJWT, AuthController.updateProfile);
router.get("/user/:username", AuthController.getPublicProfile);

// 🌐 Social Login OAuth Integration
router.get("/google", (req: Request, res: Response, next: NextFunction) => {
    const { redirectTo } = req.query as { redirectTo?: string };
    const state = redirectTo ? Buffer.from(JSON.stringify({ redirectTo })).toString('base64') : undefined;
    passport.authenticate("google", { scope: ["profile", "email"], state })(req, res, next);
});
router.get("/google/callback", passport.authenticate("google", { session: false }), AuthController.socialAuthCallback);

router.get("/github", (req: Request, res: Response, next: NextFunction) => {
    const { redirectTo } = req.query as { redirectTo?: string };
    const state = redirectTo ? Buffer.from(JSON.stringify({ redirectTo })).toString('base64') : undefined;
    passport.authenticate("github", { scope: ["user:email"], state })(req, res, next);
});
router.get("/github/callback", passport.authenticate("github", { session: false }), AuthController.socialAuthCallback);

export default router;
