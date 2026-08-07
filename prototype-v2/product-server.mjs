import { createReadStream } from 'node:fs'
import { createServer } from 'node:http'
import { extname, resolve, sep } from 'node:path'
import { fileURLToPath } from 'node:url'

const contentTypes = { '.css': 'text/css', '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript' }

function sendJson(response, statusCode, value) {
  response.statusCode = statusCode
  response.setHeader('content-type', 'application/json; charset=utf-8')
  response.end(JSON.stringify(value))
}

async function readJson(request) {
  let body = ''
  for await (const chunk of request) {
    body += chunk
    if (Buffer.byteLength(body) > 65_536) {
      const error = new Error('Request body too large')
      error.statusCode = 413
      throw error
    }
  }
  return JSON.parse(body || '{}')
}

async function readBody(request) {
  const chunks = []
  let size = 0
  for await (const chunk of request) {
    size += chunk.length
    if (size > 1_048_576) {
      const error = new Error('Request body too large')
      error.statusCode = 413
      throw error
    }
    chunks.push(chunk)
  }
  return chunks.length ? Buffer.concat(chunks) : undefined
}

async function validateTask(store, input) {
  const priorities = ['נמוכה', 'בינונית', 'גבוהה']
  if (typeof input.projectId !== 'string' || typeof input.title !== 'string') return 'projectId and title are required'
  if (!input.title.trim() || input.title.trim().length > 200) return 'title must contain 1-200 characters'
  if (input.dueLabel !== undefined && (typeof input.dueLabel !== 'string' || input.dueLabel.length > 80)) return 'dueLabel is invalid'
  if (input.priority !== undefined && !priorities.includes(input.priority)) return 'priority is invalid'
  if (!(await store.listProjects()).some((project) => project.id === input.projectId)) return 'project does not exist'
  return null
}

function bearerToken(request) {
  const match = request.headers.authorization?.match(/^Bearer\s+(.+)$/i)
  return match?.[1] ?? null
}

export function createProductHandler({ store, staticRoot, publicConfig = { mode: 'development' }, googleDrive = null, fetchImpl = fetch }) {
  const root = resolve(fileURLToPath(staticRoot))
  const supabaseOrigin = publicConfig.supabaseUrl ? new URL(publicConfig.supabaseUrl).origin : null
  const supabaseSocketOrigin = supabaseOrigin?.replace(/^https:/, 'wss:')

  return async (request, response) => {
    const url = new URL(request.url, 'http://localhost')
    try {
      const connections = ["'self'", supabaseOrigin, supabaseSocketOrigin].filter(Boolean).join(' ')
      response.setHeader('content-security-policy', `default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline' https://fonts.googleapis.com; font-src 'self' https://fonts.gstatic.com; connect-src ${connections}; img-src 'self' data:; object-src 'none'; base-uri 'self'; frame-ancestors 'none'; form-action 'self'`)
      response.setHeader('x-content-type-options', 'nosniff')
      response.setHeader('referrer-policy', 'no-referrer')
      response.setHeader('permissions-policy', 'camera=(), microphone=(), geolocation=()')
      if (url.pathname.startsWith('/supabase/')) {
        if (!supabaseOrigin || !/^\/supabase\/(auth|rest)\/v1(?:\/|$)/.test(url.pathname)) return sendJson(response, 404, { error: 'Not found' })
        const upstreamPath = url.pathname.slice('/supabase'.length)
        const upstreamUrl = new URL(`${upstreamPath}${url.search}`, `${supabaseOrigin}/`).href
        const headers = {}
        for (const name of ['accept', 'apikey', 'authorization', 'content-type', 'prefer', 'range']) {
          if (request.headers[name]) headers[name] = request.headers[name]
        }
        const body = ['GET', 'HEAD'].includes(request.method) ? undefined : await readBody(request)
        const upstream = await fetchImpl(upstreamUrl, { method: request.method, headers, body, redirect: 'manual' })
        response.statusCode = upstream.status
        for (const name of ['content-type', 'content-range', 'location', 'range-unit']) {
          const value = upstream.headers.get(name)
          if (value) response.setHeader(name, value)
        }
        response.end(Buffer.from(await upstream.arrayBuffer()))
        return
      }
      if (request.method === 'GET' && url.pathname === '/api/config') {
        if (publicConfig.mode === 'development' && !publicConfig.supabaseUrl) return sendJson(response, 200, { mode: 'development' })
        const browserOrigin = `http://${request.headers.host}`
        return sendJson(response, 200, { supabaseUrl: `${browserOrigin}/supabase`, supabaseAnonKey: publicConfig.supabaseAnonKey })
      }
      if (url.pathname === '/api/connections/google/callback') {
        if (request.method !== 'GET') return sendJson(response, 405, { error: 'Method not allowed' })
        if (!googleDrive) { response.writeHead(302, { location: '/connections.html?google=error' }); return response.end() }
        if (url.searchParams.get('error')) {
          await googleDrive.cancel?.(url.searchParams.get('state'))
          response.writeHead(302, { location: '/connections.html?google=error' }); return response.end()
        }
        await googleDrive.callback({ code: url.searchParams.get('code'), state: url.searchParams.get('state') })
        response.writeHead(302, { location: '/connections.html?google=connected' }); return response.end()
      }
      if (url.pathname.startsWith('/api/connections/google') || url.pathname === '/api/drive/files') {
        if (!googleDrive) return sendJson(response, 503, { error: 'Google Drive is not configured' })
        const token = bearerToken(request)
        if (!token) return sendJson(response, 401, { error: 'Authentication is required' })
        if (request.method === 'GET' && url.pathname === '/api/connections/google/status') return sendJson(response, 200, await googleDrive.status(token))
        if (request.method === 'POST' && url.pathname === '/api/connections/google/start') return sendJson(response, 200, await googleDrive.start(token))
        if (request.method === 'DELETE' && url.pathname === '/api/connections/google') { await googleDrive.disconnect(token); response.statusCode = 204; return response.end() }
        if (request.method === 'GET' && url.pathname === '/api/drive/files') return sendJson(response, 200, await googleDrive.listFiles(token, url.searchParams.get('pageToken') ?? undefined))
        return sendJson(response, 405, { error: 'Method not allowed' })
      }
      if (url.pathname.startsWith('/api/') && !store) return sendJson(response, 503, { error: 'Production data is available through the authenticated Supabase client' })
      if (request.method === 'GET' && url.pathname === '/api/projects') {
        return sendJson(response, 200, await store.listProjects())
      }
      if (request.method === 'GET' && url.pathname === '/api/tasks') {
        return sendJson(response, 200, await store.listTasks())
      }
      if (request.method === 'POST' && url.pathname === '/api/tasks') {
        if (!request.headers['content-type']?.toLowerCase().startsWith('application/json')) return sendJson(response, 415, { error: 'Content-Type must be application/json' })
        const input = await readJson(request)
        const validationError = await validateTask(store, input)
        if (validationError) return sendJson(response, 400, { error: validationError })
        return sendJson(response, 201, await store.createTask(input))
      }

      let pathname
      try { pathname = url.pathname === '/' ? '/index.html' : decodeURIComponent(url.pathname) } catch { return sendJson(response, 404, { error: 'Not found' }) }
      const segments = pathname.replace(/\\/g, '/').split('/').filter(Boolean)
      const publicExtension = ['.html', '.css', '.js', '.mjs'].includes(extname(pathname).toLowerCase())
      const hasUnsafeSegment = segments.some((segment) => segment.startsWith('.') || segment === '..')
      const allowedLocation = segments.length === 1 || (segments.length === 2 && segments[0] === 'vendor')
      if (!publicExtension || hasUnsafeSegment || !allowedLocation) return sendJson(response, 404, { error: 'Not found' })
      const filePath = resolve(root, `.${pathname}`)
      if (filePath !== root && !filePath.startsWith(`${root}${sep}`)) return sendJson(response, 404, { error: 'Not found' })
      response.setHeader('content-type', `${contentTypes[extname(filePath)] ?? 'application/octet-stream'}; charset=utf-8`)
      createReadStream(filePath).on('error', () => sendJson(response, 404, { error: 'Not found' })).pipe(response)
    } catch (error) {
      const status = error.statusCode ?? (error instanceof SyntaxError ? 400 : 500)
      sendJson(response, status, { error: status === 413 ? 'Request body too large' : error instanceof SyntaxError ? 'Invalid JSON' : 'Internal server error' })
    }
  }
}

export function createProductServer(options) {
  return createServer(createProductHandler(options))
}
