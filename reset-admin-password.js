/**
 * Reset Admin Password Script
 * Run with: node reset-admin-password.js
 *
 * Make sure DATABASE_URL is set in your .env.local file
 */

import { neon } from '@neondatabase/serverless'
import bcrypt from 'bcryptjs'

// Read .env.local file
import { readFileSync } from 'fs'
const envContent = readFileSync('.env.local', 'utf-8')
const DATABASE_URL = envContent.match(/DATABASE_URL=(.+)/)?.[1]?.trim()

if (!DATABASE_URL) {
  console.error('DATABASE_URL not found in .env.local')
  process.exit(1)
}

const sql = neon(DATABASE_URL)
const NEW_PASSWORD = 'Admin@123'

async function main() {
  console.log('Resetting admin password...\n')

  try {
    // Hash the new password
    const password_hash = await bcrypt.hash(NEW_PASSWORD, 10)
    console.log('New password hash generated:', password_hash)

    // Update the admin user
    const result = await sql`
      UPDATE admin_users
      SET password_hash = ${password_hash},
          updated_at = NOW()
      WHERE email = 'aa6568284@gmail.com'
      RETURNING id, email, name
    `

    if (result.length > 0) {
      console.log('\n✓ Password reset successful!')
      console.log('Email:', result[0].email)
      console.log('Name:', result[0].name)
      console.log('New Password:', NEW_PASSWORD)
      console.log('\nPlease login at: /admin/login')
    } else {
      console.log('✗ Admin user not found')
    }
  } catch (error) {
    console.error('Error:', error)
    process.exit(1)
  }
}

main()
