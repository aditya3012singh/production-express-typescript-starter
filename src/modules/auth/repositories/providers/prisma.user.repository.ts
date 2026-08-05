import DBWrapper from '../../../../core/config/db.wrapper.js';
import { IUserRepository } from '../user.repository.interface.js';

export class PrismaUserRepository implements IUserRepository {
    async findById(id: string): Promise<any | null> {
        return DBWrapper.execute('userRepoFindById', (db) =>
            db.user.findUnique({ where: { id } })
        );
    }

    async findByEmail(email: string): Promise<any | null> {
        return DBWrapper.execute('userRepoFindByEmail', (db) =>
            db.user.findUnique({ where: { email } })
        );
    }

    async findByResetToken(token: string): Promise<any | null> {
        return DBWrapper.execute('userRepoFindByResetToken', (db) =>
            db.user.findFirst({
                where: {
                    resetPasswordToken: token,
                    resetPasswordExpires: { gte: new Date() }
                }
            })
        );
    }

    async create(data: any): Promise<any> {
        return DBWrapper.execute('userRepoCreate', (db) =>
            db.user.create({ data })
        );
    }

    async update(id: string, data: any): Promise<any> {
        return DBWrapper.execute('userRepoUpdate', (db) =>
            db.user.update({
                where: { id },
                data
            })
        );
    }

    async updateByEmail(email: string, data: any): Promise<any> {
        return DBWrapper.execute('userRepoUpdateByEmail', (db) =>
            db.user.update({
                where: { email },
                data
            })
        );
    }
}
