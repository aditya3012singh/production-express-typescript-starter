import DBWrapper from '../../../../core/config/db.wrapper.js';
import { IUserRepository } from '../user.repository.interface.js';
import { UserModel } from '../../models/user.model.js';

export class MongooseUserRepository implements IUserRepository {
    async findById(id: string): Promise<any | null> {
        return DBWrapper.execute('mongooseUserRepoFindById', () =>
            UserModel.findById(id).exec()
        );
    }

    async findByEmail(email: string): Promise<any | null> {
        return DBWrapper.execute('mongooseUserRepoFindByEmail', () =>
            UserModel.findOne({ email }).exec()
        );
    }

    async findByUsername(username: string): Promise<any | null> {
        return DBWrapper.execute('mongooseUserRepoFindByUsername', () =>
            UserModel.findOne({ username }).exec()
        );
    }

    async findByEmailOrUsername(email: string, username: string): Promise<any | null> {
        return DBWrapper.execute('mongooseUserRepoFindByEmailOrUsername', () =>
            UserModel.findOne({ $or: [{ email }, { username }] }).exec()
        );
    }

    async findByResetToken(token: string): Promise<any | null> {
        return DBWrapper.execute('mongooseUserRepoFindByResetToken', () =>
            UserModel.findOne({
                resetPasswordToken: token,
                resetPasswordExpires: { $gte: new Date() }
            }).exec()
        );
    }

    async create(data: any): Promise<any> {
        return DBWrapper.execute('mongooseUserRepoCreate', () => {
            const user = new UserModel(data);
            return user.save();
        });
    }

    async update(id: string, data: any): Promise<any> {
        return DBWrapper.execute('mongooseUserRepoUpdate', () =>
            UserModel.findByIdAndUpdate(id, data, { new: true }).exec()
        );
    }

    async updateByEmail(email: string, data: any): Promise<any> {
        return DBWrapper.execute('mongooseUserRepoUpdateByEmail', () =>
            UserModel.findOneAndUpdate({ email }, data, { new: true }).exec()
        );
    }

    async findOrCreateOAuthUser(data: { email: string; username: string; profilePic?: string }): Promise<any> {
        return DBWrapper.execute('mongooseUserRepoFindOrCreateOAuth', () =>
            UserModel.findOneAndUpdate(
                { email: data.email },
                {
                    $setOnInsert: { username: data.username, password: '' },
                    $set: { profilePic: data.profilePic }
                },
                { upsert: true, new: true }
            ).exec()
        );
    }
}
