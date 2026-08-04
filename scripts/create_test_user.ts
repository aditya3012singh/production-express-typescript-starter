import "dotenv/config";
import bcrypt from "bcrypt";
import { PrismaClient } from "@prisma/client";

const prisma = new PrismaClient();

async function main() {
  // First test user
  const email = "testuser@example.com";
  const username = "testuser";
  const password = "Password123";

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    console.log("Test user already exists:", email);
  } else {
    const hashed = await bcrypt.hash(password, 12);
    const user = await prisma.user.create({
      data: {
        email,
        username,
        password: hashed,
      },
    });
    console.log("Created test user:", { email, password, id: user.id });
  }

  // Second test user
  const email2 = "testuser2@example.com";
  const username2 = "testuser2";
  const password2 = "Password456";

  const existing2 = await prisma.user.findUnique({ where: { email: email2 } });
  if (existing2) {
    console.log("Test user already exists:", email2);
  } else {
    const hashed2 = await bcrypt.hash(password2, 12);
    const user2 = await prisma.user.create({
      data: {
        email: email2,
        username: username2,
        password: hashed2,
      },
    });
    console.log("Created test user:", { email: email2, password: password2, id: user2.id });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
