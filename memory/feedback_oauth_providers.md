---
name: feedback-oauth-providers
description: Facebook (and other) OAuth providers still need credentials wired up — user asked to handle Google first and remember others for later
metadata:
  type: feedback
---

Facebook OAuth is not yet configured. The user explicitly said "let google login for now, remember me later for others."

**Why:** FACEBOOK_CLIENT_ID and FACEBOOK_CLIENT_SECRET are empty in client/.env.local. The NextAuth provider is conditionally loaded only when both vars are set, so it is a safe no-op until filled in.

**How to apply:** When the user next asks about OAuth, Facebook login, or social login — remind them that Facebook credentials are still pending. The code in lib/auth.ts already supports Facebook; just needs FACEBOOK_CLIENT_ID + FACEBOOK_CLIENT_SECRET in client/.env.local and the redirect URI http://localhost:3000/api/auth/callback/facebook registered in the Facebook Developer portal.
