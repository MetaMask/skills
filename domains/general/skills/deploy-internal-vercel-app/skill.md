---
name: deploy-internal-vercel-app
description: Use when someone wants to deploy an internal Next.js app to the Consensys Vercel Enterprise account with Okta SSO. Automates GitHub repo creation, secret audit, NextAuth.js auth gate injection, and generates a TechOps email + Vercel deployment checklist. Works with both Pages Router and App Router.
maturity: stable
---

# Deploy Internal Vercel App

Use this skill when someone wants to deploy an internal Next.js app to the Consensys Vercel Enterprise account with Okta SSO.

## Announce at start

"I'm using the deploy-internal-vercel-app skill to set up your project."

## Step 1: Collect inputs

Ask the following questions one at a time:

1. **App name** — e.g. `money-movement-dashboard` (lowercase, hyphens only — used for repo name, Vercel project name, and domain)
2. **Local project path** — absolute path to the Next.js project on your machine
3. **Your name** — for the TechOps email sign-off
4. **One-line description** — for the GitHub repo description
5. **Does the app have a cron job?** (yes/no) — if yes, ask: what is the cron route path? (e.g. `/api/cron/rotation`)

## Step 2: Preflight checks

Run these before touching anything:

```bash
# 1. Check gh CLI is authenticated
gh auth status
```
If not authenticated: halt and tell user to run `gh auth login` first.

```bash
# 2. Verify Next.js project exists
cat {project-path}/package.json | grep '"next"'
```
If `next` not found: halt and tell user this skill only works with Next.js projects.

```bash
# 3. Detect router type (check both root and src/ layouts)
ls {project-path}/app 2>/dev/null || ls {project-path}/src/app 2>/dev/null && echo "app-router"
ls {project-path}/pages 2>/dev/null || ls {project-path}/src/pages 2>/dev/null && echo "pages-router"
```
- If `app/` or `src/app/` exists → App Router (set router root accordingly)
- If `pages/` or `src/pages/` exists (and no app dir) → Pages Router
- If both app and pages dirs exist → App Router (takes precedence as the newer standard)
- If neither → halt: "Cannot detect Next.js router type. Make sure your project has an `app/`, `src/app/`, `pages/`, or `src/pages/` directory."

```bash
# 4. Check for existing git remotes
git -C {project-path} remote -v 2>/dev/null
```
If remotes exist: show them to the user and confirm before proceeding.

# 5. Check Consensys Vercel Enterprise team membership
Ask the user: "Are you already a member of the Consensys Vercel Enterprise account at vercel.com? (You can check by logging in to vercel.com and looking for a 'Consensys' team in the team switcher.)"

- **Yes**: Continue.
- **No / unsure**: Warn the user:
  > "⚠️ You need to be a member of the Consensys Vercel Enterprise account to import this project. The TechOps email in Step 6 will request membership — do not skip sending it, and wait for confirmation before trying to deploy on Vercel."
  Continue (do not halt — the email handles the request).

## Step 3: Repo hygiene

### .gitignore
Check that these entries exist. Add any that are missing:
```
node_modules/
.next/
.env.local
.env
.vercel
```

### .env.example
If it doesn't exist, create it. If it exists, scan for real secrets (tokens, webhook URLs). Flag any found and pause for the user to fix before continuing.

Ensure these auth vars are present (no real values):
```
AUTH_URL=https://{app-name}.vercel.app
AUTH_SECRET=
OKTA_CLIENT_ID=
OKTA_CLIENT_SECRET=
OKTA_ISSUER=https://your-domain.okta.com
```

If cron job: also add:
```
CRON_SECRET=
```

### Secret audit
```bash
grep -rn \
  --include="*.js" --include="*.ts" --include="*.jsx" --include="*.tsx" --include="*.json" \
  -E "(xoxb-|xoxp-|hooks\.slack\.com|atlassian\.net/rest|Bearer |api_token|apiToken)" \
  {project-path} | grep -v node_modules | grep -v ".next"
```
If any matches: show them to the user and pause. Do not proceed until the user confirms secrets are removed.

## Step 4: Inject NextAuth.js auth gate

### Check if auth already exists
- Pages Router: check for `{project-path}/pages/api/auth/[...nextauth].js`
- App Router: check for `{project-path}/app/api/auth/[...nextauth]/route.ts`

If the file exists, read it. If it already uses NextAuth with Okta, skip injection. If it uses a different auth library, warn the user and skip injection.

### If no auth handler exists — create it

**Pages Router** → create `pages/api/auth/[...nextauth].js`:
```js
import NextAuth from 'next-auth';
import OktaProvider from 'next-auth/providers/okta';

export const authOptions = {
  providers: [
    OktaProvider({
      clientId: process.env.OKTA_CLIENT_ID,
      clientSecret: process.env.OKTA_CLIENT_SECRET,
      issuer: process.env.OKTA_ISSUER,
    }),
  ],
};

export default NextAuth(authOptions);
```

**App Router** → create `app/api/auth/[...nextauth]/route.ts`:
```ts
import NextAuth from 'next-auth';
import OktaProvider from 'next-auth/providers/okta';

export const authOptions = {
  providers: [
    OktaProvider({
      clientId: process.env.OKTA_CLIENT_ID!,
      clientSecret: process.env.OKTA_CLIENT_SECRET!,
      issuer: process.env.OKTA_ISSUER,
    }),
  ],
};

const handler = NextAuth(authOptions);
export { handler as GET, handler as POST };
```

### Add auth gate to main page (commented out until Okta is ready)

**Pages Router** — add to `pages/index.js` (or `pages/index.tsx`):
```js
import { getServerSession } from 'next-auth/next';
import { authOptions } from './api/auth/[...nextauth]';

export async function getServerSideProps(context) {
  // Auth gate — uncomment after adding OKTA_* env vars to Vercel
  // const session = await getServerSession(context.req, context.res, authOptions);
  // if (!session) {
  //   return { redirect: { destination: '/api/auth/signin', permanent: false } };
  // }
  return { props: {} };
}
```

**App Router** — add to top of `app/page.tsx`:
```ts
// Auth gate — uncomment after adding OKTA_* env vars to Vercel
// import { getServerSession } from 'next-auth/next';
// import { authOptions } from './api/auth/[...nextauth]/route';
// const session = await getServerSession(authOptions);
// if (!session) { redirect('/api/auth/signin'); }
```

### Install next-auth
Add `"next-auth": "^4.24.7"` to `dependencies` in `package.json`, then run:
```bash
npm install next-auth --prefix {project-path}
```

### Update README.md
Add an "Authentication (Okta SSO)" section documenting:
- How to request the Okta app from TechOps (`techops@consensys.net`)
- The callback URL format
- Which env vars are needed

## Step 5: Create GitHub repo and push

### Try Consensys org first
```bash
gh repo create Consensys/{app-name} \
  --private \
  --description "{description}"
```

If this fails (no permission): fall back to personal account:
```bash
gh repo create {app-name} \
  --private \
  --description "{description} (transfer to Consensys org pending)"
```
Warn the user: "Created under your personal account — you'll need to transfer to Consensys org later via GitHub Settings."

Store the actual repo URL for all downstream outputs.

### Git init and commit
```bash
git -C {project-path} init
git -C {project-path} branch -M main
git -C {project-path} add .
git -C {project-path} commit -m "Initial commit: {app-name}"
```

### Push via GitHub API (avoids branch protection rules)
```bash
# Push to a temp branch first so the commit exists remotely
git -C {project-path} remote add origin https://github.com/{actual-repo-path}.git
git -C {project-path} push origin HEAD:refs/heads/tmp-init

# Create main ref via API (repo is empty so main doesn't exist yet — use POST not PATCH)
gh api repos/{actual-repo-path}/git/refs \
  --method POST \
  --field ref=refs/heads/main \
  --field sha=$(git -C {project-path} rev-parse HEAD)

# Clean up temp branch
gh api repos/{actual-repo-path}/git/refs/heads/tmp-init \
  --method DELETE
```

## Step 6: Output TechOps email

Print this copy-pasteable email (substitute all placeholders):

```
To: techops@consensys.net
Subject: Internal App Setup Request — {app-name}

Hi TechOps,

I'm deploying an internal Next.js app and need a few things set up:

1. Add me to the Consensys Vercel Enterprise team (if not already a member)
   GitHub: {gh-username}

2. Grant Vercel access to this private GitHub repo:
   https://github.com/{actual-repo-path}

3. Create an Okta OIDC Web Application:
   App name: {app-name}
   Sign-in redirect URI: https://{app-name}.vercel.app/api/auth/callback/okta
   Sign-out redirect URI: https://{app-name}.vercel.app

   Note: if a custom domain is used instead of .vercel.app, update these URIs accordingly.

Please share OKTA_CLIENT_ID, OKTA_CLIENT_SECRET, and OKTA_ISSUER when ready.

Thanks,
{name}
```

## Step 7: Output Vercel deployment checklist

```
VERCEL DEPLOYMENT CHECKLIST
============================
1. Go to vercel.com → switch to Consensys team → New Project
2. Import: https://github.com/{actual-repo-path}
3. Framework preset: Next.js (auto-detected — leave defaults)
4. Expand "Environment Variables" and add:
   - AUTH_SECRET = <run: openssl rand -base64 32>
{if-cron}   - CRON_SECRET = <run: openssl rand -hex 32>
   [add any other app-specific vars from .env.example]
   ⚠️ Skip OKTA_* and AUTH_URL for now
5. Click Deploy
6. Once deployed, note your URL (e.g. https://{app-name}.vercel.app)
7. Add AUTH_URL = https://{app-name}.vercel.app → Save → Redeploy
```

## Step 8: Output post-deploy checklist

```
POST-DEPLOY CHECKLIST (after TechOps responds with Okta credentials)
=====================================================================
0. Confirm AUTH_URL is already set in Vercel (from step 7 above)
1. Add to Vercel env vars: OKTA_CLIENT_ID, OKTA_CLIENT_SECRET, OKTA_ISSUER → Save
2. Uncomment the auth gate in {pages/index.js or app/page.tsx}
3. Push the change — Vercel will auto-deploy
4. Visit the app URL and confirm Okta login flow works end-to-end
{if-cron}5. Verify cron dry-run:
   curl -X POST https://{app-name}.vercel.app/{user-provided-cron-route} \
     -H "Authorization: Bearer $CRON_SECRET"
{last-step}. Decommission any previous personal Vercel deployment
```

## Done

Tell the user:
"Your app is on GitHub and ready to import into Vercel. Send the TechOps email above, then follow the Vercel checklist. Once TechOps responds with Okta credentials, follow the post-deploy checklist to enable the auth gate."
