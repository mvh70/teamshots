#!/usr/bin/env node

// Load environment variables (.env.local preferred, fallback to .env)
const fs = require('fs')
const path = require('path')
const root = process.cwd()
const envLocal = path.join(root, '.env.local')
const envDefault = path.join(root, '.env')
if (fs.existsSync(envLocal)) {
  require('dotenv').config({ path: envLocal })
} else if (fs.existsSync(envDefault)) {
  require('dotenv').config({ path: envDefault })
}

const { Resend } = require('resend')

function parseArgs(argv) {
  const args = {}
  for (let i = 2; i < argv.length; i++) {
    const part = argv[i]
    if (part.startsWith('--')) {
      const [key, ...rest] = part.replace(/^--/, '').split('=')
      if (rest.length > 0) {
        args[key] = rest.join('=')
      } else if (i + 1 < argv.length && !argv[i + 1].startsWith('--')) {
        args[key] = argv[++i]
      } else {
        args[key] = true
      }
    }
  }
  return args
}

function usage() {
  console.log(`
Send an email via Resend

Usage:
  node scripts/send-email.js \
    --to you@example.com[,other1@example.com,other2@example.com] \
    --subject "Hello" \
    [--text "Plain text body"] \
    [--html "<strong>HTML body</strong>"] \
    [--from "Brand <hello@yourdomain.com>"] \
    [--replyTo support@yourdomain.com]

Required ENV (in project root):
  RESEND_API_KEY  (set in .env.local or .env)

Optional ENV:
  EMAIL_FROM (default fallback for --from)
`)
}

async function main() {
  const args = parseArgs(process.argv)
  if (args.help || args.h) { usage(); process.exit(0) }

  const RESEND_API_KEY = process.env.RESEND_API_KEY
  if (!RESEND_API_KEY) {
    console.error('Missing RESEND_API_KEY in environment')
    process.exit(1)
  }

  const toArg = args.to
  const subject = args.subject
  const text = args.text
  const html = args.html
  const from = args.from || process.env.EMAIL_FROM || 'no-reply@example.com'
  const replyTo = args.replyTo

  if (!toArg || !subject || (!text && !html)) {
    console.error('Missing required arguments: --to, --subject, and at least one of --text or --html')
    usage()
    process.exit(1)
  }

  const toParts = String(toArg).split(',').map((s) => s.trim()).filter(Boolean)
  const to = toParts.length === 1 ? toParts[0] : toParts

  const resend = new Resend(RESEND_API_KEY)

  try {
    const { data, error } = await resend.emails.send({
      from,
      to,
      subject,
      text,
      html,
      replyTo,
    })

    if (error) {
      console.error('❌ Failed to send email:', error)
      process.exit(2)
    }

    console.log('✅ Email sent:', data)
  } catch (err) {
    console.error('❌ Error sending email:', err)
    process.exit(3)
  }
}

main().catch((e) => { console.error(e); process.exit(4) })


