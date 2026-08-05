import { IUserRepository } from '../user.repository.interface.js';
import { UserModel } from '../../models/user.model.js';

export class MongooseUserRepository implements IUserRepository {
    async findById(id: string): Promise<any | null> {
        return UserModel.findById(id).exec();
    }

    async findByEmail(email: string): Promise<any | null> {
        return UserModel.findOne({ email }).exec();
    }

    async findByResetToken(token: string): Promise<any | null> {
        return UserModel.findOne({
            resetPasswordToken: token,
            resetPasswordExpires: { $gte: new Date() }
        }).exec();
    }

    async create(data: any): Promise<any> {
        const user = new UserModel(data);
        return user.save();
    }

    async update(id: string, data: any): Promise<any> {
        return UserModel.findByIdAndUpdate(id, data, { new: true }).exec();
    }

    async updateByEmail(email: string, data: any): Promise<any> {
        return UserModel.findOneAndUpdate({ email }, data, { new: true }).exec();
    }
}
