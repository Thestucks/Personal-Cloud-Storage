// Helper: Generate ENC_KEY — string apa pun bisa dipakai, minimal 16 karakter
// Karena di utils.js sudah di-SHA-256 (jadi selalu 32 bytes untuk AES-256)
//
// Run: node migrations/migration_utils.js

import crypto from 'crypto'

const key = crypto.randomBytes(32).toString('hex')
console.log('=== ENC_KEY (simpan aman, jangan commit) ===')
console.log(key)
console.log('')
console.log('Atau bisa juga pakai password bebas seperti:')
console.log('ini-adalah-enc-key-saya-2026-rahasia')
