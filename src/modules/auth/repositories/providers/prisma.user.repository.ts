import DBWrapper from '../../../../core/config/db.wrapper.js';
import { prisma } from '../../../../core/config/db.js';
import { IUserRepository } from '../user.repository.interface.js';

export class PrismaUserRepository implements IUserRepository {
    async findById(id: string): Promise<any | null> {
        return DBWrapper.execute('userRepoFindById', (db = prisma) =>
            db.user.findUnique({ where: { id } })
        );
    }

    async findByEmail(email: string): Promise<any | null> {
        return DBWrapper.execute('userRepoFindByEmail', (db = prisma) =>
            db.user.findUnique({ where: { email } })
        );
    }

    async findByUsername(username: string): Promise<any | null> {
        return DBWrapper.execute('userRepoFindByUsername', (db = prisma) =>
            db.user.findUnique({ where: { username } })
        );
    }

    async findByEmailOrUsername(email: string, username: string): Promise<any | null> {
        return DBWrapper.execute('userRepoFindByEmailOrUsername', (db = prisma) =>
            db.user.findFirst({
                where: { OR: [{ email }, { username }] }
            })
        );
    }

    async findByResetToken(token: string): Promise<any | null> {
        return DBWrapper.execute('userRepoFindByResetToken', (db = prisma) =>
            db.user.findFirst({
                where: {
                    resetPasswordToken: token,
                    resetPasswordExpires: { gte: new Date() }
                }
            })
        );
    }

    async create(data: any): Promise<any> {
        return DBWrapper.execute('userRepoCreate', (db = prisma) =>
            db.user.create({ data })
        );
    }

    async update(id: string, data: any): Promise<any> {
        return DBWrapper.execute('userRepoUpdate', (db = prisma) =>
            db.user.update({
                where: { id },
                data
            })
        );
    }

    async updateByEmail(email: string, data: any): Promise<any> {
        return DBWrapper.execute('userRepoUpdateByEmail', (db = prisma) =>
            db.user.update({
                where: { email },
                data
            })
        );
    }

    async findOrCreateOAuthUser(data: { email: string; username: string; profilePic?: string }): Promise<any> {
        return DBWrapper.execute('userRepoFindOrCreateOAuth', (db = prisma) =>
            db.user.upsert({
                where: { email: data.email },
                update: { profilePic: data.profilePic },
                create: {
                    username: data.username,
                    email: data.email,
                    password: '',
                    profilePic: data.profilePic
                }
            })
        );
    }
}
