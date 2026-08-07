import { createProductHandler } from '../prototype-v2/product-server.mjs'
import { loadProductConfig } from '../prototype-v2/product-config.mjs'
import { createGoogleConnectionRepository, createGoogleDriveService, loadGoogleDriveConfig } from '../prototype-v2/google-drive.mjs'

const staticRoot = new URL('../prototype-v2/', import.meta.url)
const publicConfig = loadProductConfig()
let googleDrive = null
try {
  const googleConfig = loadGoogleDriveConfig()
  googleDrive = createGoogleDriveService({ config: googleConfig, repository: createGoogleConnectionRepository({ config: googleConfig }) })
} catch (error) {
  if (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) throw error
}

const handler = createProductHandler({ store: null, staticRoot, publicConfig, googleDrive })
export default async function vercelHandler(request, response) {
  return handler(request, response)
}
