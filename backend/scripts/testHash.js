const bcrypt = require("bcryptjs");
const hash = "$2b$10$zyK8UdD2ZCe0ugF1SzaJHeWQb0WJ6J9E6o/BwjFERFav8PatHa.fu";
async function main() {
  const isMatch1 = await bcrypt.compare("password123", hash);
  console.log("password123 matches:", isMatch1);
  const isMatch2 = await bcrypt.compare("admin", hash);
  console.log("admin matches:", isMatch2);
  const isMatch3 = await bcrypt.compare("123456", hash);
  console.log("123456 matches:", isMatch3);
}
main();
