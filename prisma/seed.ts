import "dotenv/config";
import { PrismaClient } from "@prisma/client";
import bcrypt from "bcrypt";

const prisma = new PrismaClient();

async function main() {
  console.log("🌱 Seeding database...");

  // 1. CLEAN DATABASE
  console.log("🧹 Wiping old user data...");
  try {
    await prisma.$executeRawUnsafe(`TRUNCATE TABLE "User" RESTART IDENTITY CASCADE;`);
    console.log("✅ User table wiped clean.\n");
  } catch (e: any) {
    console.log("⚠️ Could not truncate User table:", e.message);
  }

  // 2. SEED ADMIN USER
  console.log("👤 Generating Admin User...");
  const hashedAdminPassword = await bcrypt.hash("admin123", 12);
  await prisma.user.upsert({
    where: { email: "admin@basebackend.com" },
    update: { role: "ADMIN", password: hashedAdminPassword },
    create: {
      email: "admin@basebackend.com",
      username: "Admin",
      password: hashedAdminPassword,
      role: "ADMIN"
    }
  });
  console.log("✅ Admin user seeded.\n");
}

main()
  .catch((e) => {
    console.error("Critical error in seed main:", e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
