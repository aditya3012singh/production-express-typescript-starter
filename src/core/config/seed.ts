import 'dotenv/config';
import bcrypt from 'bcrypt';
import Database from './db.js';
import { UserModel } from '../../modules/auth/models/user.model.js';

async function main() {
    console.log('🌱 Seeding MongoDB database...');

    // 1. Connect to Database
    await Database.connect();

    // 2. WIPE EXISTING USERS
    console.log('🧹 Wiping old user data...');
    try {
        await UserModel.deleteMany({});
        console.log('✅ User collection wiped clean.\n');
    } catch (e: any) {
        console.log('⚠️ Could not wipe User collection:', e.message);
    }

    // 3. SEED ADMIN USER
    console.log('👤 Generating Admin User...');
    const hashedAdminPassword = await bcrypt.hash('admin123', 10);
    await UserModel.findOneAndUpdate(
        { email: 'admin@basebackend.com' },
        {
            username: 'Admin',
            email: 'admin@basebackend.com',
            password: hashedAdminPassword,
            role: 'ADMIN'
        },
        { upsert: true, new: true }
    );
    console.log('✅ Admin user seeded.\n');
}

main()
    .catch((e) => {
        console.error('Critical error in seed main:', e);
        process.exit(1);
    })
    .finally(async () => {
        await Database.disconnect();
    });
