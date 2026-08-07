import { createHash } from 'node:crypto'
import { copyFile, readFile } from 'node:fs/promises'

const source = new URL('../node_modules/@supabase/supabase-js/dist/umd/supabase.js', import.meta.url)
const target = new URL('../vendor/supabase.js', import.meta.url)
const digest = (bytes) => createHash('sha256').update(bytes).digest('hex')

if (process.argv.includes('--check')) {
  const [installed, vendored] = await Promise.all([readFile(source), readFile(target)])
  if (digest(installed) !== digest(vendored)) throw new Error('Vendored Supabase SDK is out of date; run npm run vendor:sync')
  console.log(`Supabase vendor verified: sha256:${digest(vendored)}`)
} else {
  await copyFile(source, target)
  console.log(`Supabase vendor updated: sha256:${digest(await readFile(target))}`)
}
