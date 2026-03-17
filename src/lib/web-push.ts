// eslint-disable-next-line @typescript-eslint/no-require-imports
const webPushLib = require('web-push')

let initialized = false

export function webPush() {
  if (!initialized) {
    const vapidPublicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
    const vapidPrivateKey = process.env.VAPID_PRIVATE_KEY
    if (vapidPublicKey && vapidPrivateKey) {
      webPushLib.setVapidDetails(
        'mailto:alucero.tech@gmail.com',
        vapidPublicKey,
        vapidPrivateKey
      )
      initialized = true
    }
  }
  return webPushLib
}
