import { join } from 'node:path'
import { fileURLToPath } from 'node:url'
import { createDataStore } from './data-store.mjs'
import { createProductServer } from './product-server.mjs'
import { loadProductConfig } from './product-config.mjs'
import { createGoogleConnectionRepository, createGoogleDriveService, loadGoogleDriveConfig } from './google-drive.mjs'

const root = new URL('.', import.meta.url)
const config = loadProductConfig()
const dataPath = process.env.PERSONAL_HUB_DATA_PATH ?? join(fileURLToPath(root), 'data', 'app.json')
const store = config.mode === 'development' ? createDataStore(dataPath) : null
let googleDrive = null
try {
  const googleConfig = loadGoogleDriveConfig()
  googleDrive = createGoogleDriveService({ config: googleConfig, repository: createGoogleConnectionRepository({ config: googleConfig }) })
} catch (error) {
  if (process.env.GOOGLE_CLIENT_ID || process.env.GOOGLE_CLIENT_SECRET || process.env.GOOGLE_TOKEN_ENCRYPTION_KEY) throw error
}
createProductServer({ store, staticRoot: root, publicConfig: config, googleDrive })
  .listen(Number(process.env.PORT ?? process.argv[2] ?? 4173), process.env.HOST ?? '127.0.0.1')
