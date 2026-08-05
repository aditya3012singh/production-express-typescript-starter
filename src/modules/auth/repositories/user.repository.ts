import { PrismaUserRepository } from './providers/prisma.user.repository.js';
import { IUserRepository } from './user.repository.interface.js';

const userRepository: IUserRepository = new PrismaUserRepository();
export default userRepository;
