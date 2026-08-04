import passport from 'passport';
import { Strategy as GoogleStrategy } from 'passport-google-oauth20';
import { Strategy as GitHubStrategy } from 'passport-github2';
import env from '../../core/config/env.js';
import DBWrapper from '../../core/config/db.wrapper.js';

// Configure Google Strategy if credentials exist
if (env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET) {
    passport.use(new GoogleStrategy({
        clientID: env.GOOGLE_CLIENT_ID,
        clientSecret: env.GOOGLE_CLIENT_SECRET,
        callbackURL: env.GOOGLE_CALLBACK_URL || 'http://localhost:4000/api/auth/google/callback',
        scope: ['profile', 'email']
    }, async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email found in Google profile'));

            const user = await DBWrapper.execute('oauthGoogleUpsert', (db) => 
                db.user.upsert({
                    where: { email },
                    update: { profilePic: profile.photos?.[0]?.value },
                    create: {
                        username: `google_${profile.id}`,
                        email,
                        password: '', // Password not required for OAuth users
                        profilePic: profile.photos?.[0]?.value
                    }
                })
            );

            return done(null, user as any);
        } catch (err: any) {
            return done(err);
        }
    }));
}

// Configure GitHub Strategy if credentials exist
if (env.GITHUB_CLIENT_ID && env.GITHUB_CLIENT_SECRET) {
    passport.use(new GitHubStrategy({
        clientID: env.GITHUB_CLIENT_ID,
        clientSecret: env.GITHUB_CLIENT_SECRET,
        callbackURL: env.GITHUB_CALLBACK_URL || 'http://localhost:4000/api/auth/github/callback',
        scope: ['user:email']
    }, async (_accessToken: string, _refreshToken: string, profile: any, done: any) => {
        try {
            const email = profile.emails?.[0]?.value;
            if (!email) return done(new Error('No email found in GitHub profile'));

            const user = await DBWrapper.execute('oauthGithubUpsert', (db) =>
                db.user.upsert({
                    where: { email },
                    update: { profilePic: profile.photos?.[0]?.value },
                    create: {
                        username: profile.username || `github_${profile.id}`,
                        email,
                        password: '',
                        profilePic: profile.photos?.[0]?.value
                    }
                })
            );

            return done(null, user as any);
        } catch (err: any) {
            return done(err);
        }
    }));
}

passport.serializeUser((user: any, done) => {
    done(null, user);
});

passport.deserializeUser((user: any, done) => {
    done(null, user);
});

export default passport;
