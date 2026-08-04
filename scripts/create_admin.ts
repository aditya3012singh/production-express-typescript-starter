import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcrypt';

const prisma = new PrismaClient();

async function main() {
  console.log("Generating Admin user...");
  const hashedPassword = await bcrypt.hash("admin123", 12);
  
  const admin = await prisma.user.upsert({
    where: { email: "admin@basebackend.com" },
    update: {
      role: "ADMIN",
      password: hashedPassword
    },
    create: {
      email: "admin@basebackend.com",
      username: "Admin",
      password: hashedPassword,
      role: "ADMIN"
    }
  });

  console.log("✅ Admin user successfully generated!");
  console.log("-----------------------------------------");
  console.log("Email: admin@basebackend.com");
  console.log("Password: admin123");
  console.log("Username: " + admin.username);
  console.log("Role: " + admin.role);
  console.log("-----------------------------------------");
}

main()
  .catch(e => {
    console.error("❌ Failed to create Admin User:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
