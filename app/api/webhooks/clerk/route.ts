export const dynamic = 'force-dynamic'

import { headers } from 'next/headers'
import { Webhook } from 'svix'
import { db } from '@/lib/db'

interface ClerkUserEvent {
  type: string
  data: {
    id: string
    email_addresses: Array<{ email_address: string }>
    username: string | null
    first_name: string | null
    last_name: string | null
    image_url: string
  }
}

export async function POST(req: Request) {
  const webhookSecret = process.env.CLERK_WEBHOOK_SECRET
  if (!webhookSecret) return new Response('Webhook secret not configured', { status: 500 })

  const headerPayload = await headers()
  const svixId = headerPayload.get('svix-id')
  const svixTimestamp = headerPayload.get('svix-timestamp')
  const svixSignature = headerPayload.get('svix-signature')

  if (!svixId || !svixTimestamp || !svixSignature) {
    return new Response('Missing svix headers', { status: 400 })
  }

  const payload = await req.text()
  const wh = new Webhook(webhookSecret)

  let event: ClerkUserEvent
  try {
    event = wh.verify(payload, {
      'svix-id': svixId,
      'svix-timestamp': svixTimestamp,
      'svix-signature': svixSignature,
    }) as ClerkUserEvent
  } catch {
    return new Response('Invalid webhook signature', { status: 400 })
  }

  if (event.type === 'user.created') {
    const { id, email_addresses, username, first_name, last_name, image_url } = event.data
    const email = email_addresses[0]?.email_address
    const displayName = username || `${first_name || ''}${last_name || ''}`.trim() || email?.split('@')[0] || `user_${id.slice(-6)}`

    // Ensure username is unique
    const existingUser = await db.user.findFirst({
      where: { OR: [{ clerkId: id }, { username: displayName }] },
    })

    if (!existingUser) {
      const startingBalance = Number(process.env.STARTING_BALANCE || 100000)

      await db.user.create({
        data: {
          clerkId: id,
          username: displayName,
          email: email || '',
          avatarUrl: image_url,
          account: {
            create: {
              cashBalance: startingBalance,
              startingBalance: startingBalance,
            },
          },
        },
      })
    }
  }

  if (event.type === 'user.updated') {
    const { id, image_url } = event.data
    await db.user.updateMany({
      where: { clerkId: id },
      data: { avatarUrl: image_url },
    })
  }

  return new Response('OK', { status: 200 })
}
