// eslint-disable-next-line @typescript-eslint/no-require-imports
const webPush = require('web-push')

webPush.setVapidDetails(
  'mailto:alucero.tech@gmail.com',
  process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY!,
  process.env.VAPID_PRIVATE_KEY!
)

export { webPush }
