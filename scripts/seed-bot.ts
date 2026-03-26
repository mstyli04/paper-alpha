import { PrismaClient } from '@prisma/client'

const db = new PrismaClient()

async function main() {
  const BOT_CLERK_ID = 'bot_algo_alpha_internal'
  const STARTING_BALANCE = 100000

  const existing = await db.user.findUnique({ where: { clerkId: BOT_CLERK_ID } })
  if (existing) {
    console.log('Bot account already exists:', existing.id)
    const account = await db.paperAccount.findUnique({ where: { userId: existing.id } })
    if (account) console.log('Account ID:', account.id)
    return
  }

  const user = await db.user.create({
    data: {
      clerkId:  BOT_CLERK_ID,
      username: 'algo-alpha-bot',
      email:    'bot@paperalpha.internal',
      isBot:    true,
      account: {
        create: {
          cashBalance:     STARTING_BALANCE,
          startingBalance: STARTING_BALANCE,
          isBot:           true,
        },
      },
    },
    include: { account: true },
  })

  console.log('Bot account created:')
  console.log('  User ID:    ', user.id)
  console.log('  Account ID: ', user.account!.id)
  console.log('')
  console.log('Save Account ID as BOT_ACCOUNT_ID in your .env.local')
}

main().catch(e => { console.error(e); process.exit(1) }).finally(() => db.$disconnect())
