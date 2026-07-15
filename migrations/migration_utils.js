// Helper script to generate ENC_KEY
// Run: node migration_utils.js
import crypto from 'crypto'

const key = crypto.randomBytes(32).toString('hex')
console.log('Copy this as your ENC_KEY secret:')
console.log(key)
