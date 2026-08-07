# Google Drive setup

The integration uses Google's web-server OAuth authorization-code flow and requests only `drive.readonly`. Google tokens never enter browser storage.

## Database

Run both migrations in order: `supabase/migrations/003_google_drive_connections.sql`, then `supabase/migrations/004_google_reauthorization_state.sql`. Confirm the table exists and RLS is enabled.

## Google Cloud

1. Create or select a Google Cloud project.
2. In **APIs & Services → Library**, enable **Google Drive API**.
3. Configure **Google Auth platform** with app name, support email, and developer contact.
4. Choose **External** for a personal account. While in Testing, add your Google account under **Test users**.
5. Under **Data Access**, add exactly `https://www.googleapis.com/auth/drive.readonly`.
6. Create an OAuth client of type **Web application**.
7. Add this exact Authorized redirect URI: `http://127.0.0.1:4173/api/connections/google/callback`.
8. Put the client ID and client secret only in the server environment.

## Server environment

Copy workspace-root `.env.product.example` to `.env.product.local`. Keep this secret-bearing file outside the `prototype-v2` static root. Generate the 32-byte encryption key once in PowerShell:

```powershell
$bytes = New-Object byte[] 32
[Security.Cryptography.RandomNumberGenerator]::Fill($bytes)
[Convert]::ToBase64String($bytes)
```

Store that output as `GOOGLE_TOKEN_ENCRYPTION_KEY`. Do not commit it. Changing or losing it makes stored tokens unreadable.

Start from workspace root with `node --env-file=.env.product.local prototype-v2/server.mjs 4173`, sign in through Supabase, then visit `/connections.html`.

`drive.readonly` is a restricted scope. This foundation is appropriate for explicit test users, but public production use may require Google verification and a security assessment. Before release, decide whether full read-only access is essential or whether the narrower `drive.file` scope (only files the app creates or the user explicitly opens with it) meets the product requirement.

For deployment, add an exact HTTPS production callback in Google Cloud and set `GOOGLE_REDIRECT_URI` to it. Add the production login URL to Supabase. Production gates: move OAuth state to a shared encrypted TTL store, and move token ciphertext behind a server-only/private vault or backend boundary. The current RLS table is a local/test foundation, not the final multi-instance secret vault.

Official references:

- https://developers.google.com/identity/protocols/oauth2/web-server
- https://developers.google.com/identity/protocols/oauth2/resources/best-practices
- https://developers.google.com/workspace/drive/api/reference/rest/v3/files/list
