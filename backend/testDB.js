const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  try {
    const user = await prisma.user.findUnique({ where: { email: "admin@vit.edu" } });
    console.log("USER IN DB:", user);
  } catch(e) {
    console.error("DB ERROR:", e);
  } finally {
    await prisma.$disconnect();
  }
}
main();
