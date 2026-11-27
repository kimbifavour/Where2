// Promote an existing user to admin: node scripts/make-admin.js someone@example.com
const { pool, query } = require('../db/database');

async function main() {
  const email = String(process.argv[2] || '').trim().toLowerCase();
  if (!email) {
    console.error('Usage: node scripts/make-admin.js <email>');
    process.exitCode = 1;
    return;
  }

  const [result] = await query("UPDATE users SET role = 'admin' WHERE email = ?", [email]);
  if (!result.affectedRows) {
    console.error(`No user found with email ${email}. Register the account first.`);
    process.exitCode = 1;
    return;
  }
  console.log(`${email} is now an admin.`);
}

main()
  .catch((error) => {
    console.error('Could not promote user:', error.message);
    process.exitCode = 1;
  })
  .finally(() => pool.end());
