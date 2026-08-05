import mongoose, { Schema, Document } from 'mongoose';

export interface IUser extends Document {
    email: string;
    username: string;
    password?: string;
    role: 'USER' | 'ADMIN';
    profilePic?: string | null;
    linkedin?: string | null;
    github?: string | null;
    refreshTokenHash?: string | null;
    tokenVersion: number;
    resetPasswordToken?: string | null;
    resetPasswordExpires?: Date | null;
    loginAttempts: number;
    lockUntil?: Date | null;
    createdAt: Date;
    updatedAt: Date;
}

const UserSchema: Schema = new Schema(
    {
        email: { type: String, required: true, unique: true, index: true },
        username: { type: String, required: true, unique: true },
        password: { type: String },
        role: { type: String, enum: ['USER', 'ADMIN'], default: 'USER' },
        profilePic: { type: String, default: null },
        linkedin: { type: String, default: null },
        github: { type: String, default: null },
        refreshTokenHash: { type: String, default: null },
        tokenVersion: { type: Number, default: 0 },
        resetPasswordToken: { type: String, default: null },
        resetPasswordExpires: { type: Date, default: null },
        loginAttempts: { type: Number, default: 0 },
        lockUntil: { type: Date, default: null },
    },
    {
        timestamps: true,
    }
);

UserSchema.virtual('id').get(function (this: any) {
    return this._id.toHexString();
});

UserSchema.set('toJSON', {
    virtuals: true,
    transform: (_, ret: any) => {
        delete ret._id;
        delete ret.__v;
        return ret;
    },
});

export const UserModel = mongoose.model<IUser>('User', UserSchema);
