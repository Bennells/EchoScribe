# Firebase Emulator Auth Token Verification Fix

## Problem

When running EchoScribe in development mode with Firebase Emulator, Stripe checkout was failing with this error:

```
FirebaseAuthError: Firebase ID token has no "kid" claim.
```

## Root Cause

The Firebase Admin SDK's `verifyIdToken()` method expects production-format tokens that include a "kid" (key ID) claim in the JWT header. However, Firebase Emulator generates tokens with a different format that lacks this claim.

### Token Format Differences:

**Production Token Header:**
```json
{
  "alg": "RS256",
  "kid": "abc123...",  // ← This is missing in emulator tokens
  "typ": "JWT"
}
```

**Emulator Token Header:**
```json
{
  "alg": "none",  // ← Emulator uses "none" algorithm
  "typ": "JWT"
}
```

## Solution

We implemented dual-mode token handling in the Stripe API routes:

### Files Modified:
1. `app/api/stripe/create-checkout-session/route.ts`
2. `app/api/stripe/create-portal-session/route.ts`

### Implementation:

```typescript
// Detect emulator mode
const isEmulator = process.env.NEXT_PUBLIC_USE_FIREBASE_EMULATOR === "true";
let decodedToken: { uid: string; email?: string };

if (isEmulator) {
  // Decode without verification for emulator (safe in local dev)
  const base64Payload = token.split(".")[1];
  const payload = Buffer.from(base64Payload, "base64").toString();
  decodedToken = JSON.parse(payload);
} else {
  // Verify token in production (secure)
  decodedToken = await adminAuth.verifyIdToken(token);
}
```

## How It Works

### Development Mode (Emulator):
1. User logs in through Firebase Emulator Auth
2. Emulator generates a token without "kid" claim
3. Token is stored in httpOnly cookie via `/api/auth/set-token`
4. When calling Stripe API routes, token is decoded **without verification**
5. User ID and email are extracted from decoded token
6. Stripe checkout proceeds successfully

### Production Mode:
1. User logs in through Firebase Auth (production)
2. Firebase generates a proper signed token with "kid" claim
3. Token is stored in httpOnly cookie
4. When calling Stripe API routes, token is **verified and validated**
5. User ID and email are extracted from verified token
6. Stripe checkout proceeds securely

## Security Considerations

### Is it safe to skip verification in emulator mode?

**Yes, for local development:**
- Emulator runs only on localhost
- No real user data or payments
- Tokens are still validated by Firebase client SDK before being set
- Only the server-side verification step is bypassed

**No, for production:**
- Production mode always uses full token verification
- Tokens are cryptographically validated against Firebase's public keys
- Prevents token tampering and unauthorized access

### Why not use Firebase Auth Emulator for Admin SDK?

We considered setting `FIREBASE_AUTH_EMULATOR_HOST` for the Admin SDK, but:
- Requires additional environment configuration
- Emulator verification still has limitations
- Current approach is simpler and follows existing patterns in the codebase
- Already established in `lib/firebase/admin.ts` initialization

## Testing

### To Test Locally:

1. Ensure emulator mode is enabled:
   ```bash
   # In .env.local
   NEXT_PUBLIC_USE_FIREBASE_EMULATOR=true
   ```

2. Start the emulator and dev server:
   ```bash
   npm run emulators  # Terminal 1
   npm run dev        # Terminal 2
   ```

3. Test the flow:
   - Register/login to create a test user
   - Navigate to `/dashboard/pricing`
   - Click "Jetzt upgraden" on any paid tier
   - Should successfully redirect to Stripe Checkout (no auth error)

### Expected Behavior:

**Before Fix:**
```
❌ Error: Firebase ID token has no "kid" claim
❌ Stripe checkout fails
❌ 500 Internal Server Error
```

**After Fix:**
```
✅ Token decoded successfully (emulator mode)
✅ Redirect to Stripe Checkout
✅ Tier and userId passed in metadata
```

## Related Files

### Authentication Flow:
- `lib/firebase/auth-context.tsx` - Client-side auth, sets token in cookie
- `app/api/auth/set-token/route.ts` - Stores Firebase token in httpOnly cookie
- `app/api/auth/clear-token/route.ts` - Clears token on logout

### Admin SDK Setup:
- `lib/firebase/admin.ts` - Firebase Admin SDK initialization (detects emulator mode)

### Stripe Integration:
- `app/api/stripe/create-checkout-session/route.ts` - Creates Stripe checkout (FIXED)
- `app/api/stripe/create-portal-session/route.ts` - Opens Stripe portal (FIXED)
- `app/api/webhooks/stripe/route.ts` - Handles Stripe webhooks (no auth needed)

## Alternative Solutions Considered

### 1. Set FIREBASE_AUTH_EMULATOR_HOST for Admin SDK
**Pros:** Official Firebase approach
**Cons:**
- Requires more configuration
- Still has token format issues
- Doesn't solve the underlying "kid" claim problem

### 2. Mock Admin Auth in Emulator
**Pros:** Complete emulation
**Cons:**
- Complex setup
- Requires test doubles
- Maintains two code paths

### 3. Use Different Auth Flow for Development
**Pros:** Cleaner separation
**Cons:**
- Divergent code paths
- Hard to test production behavior locally
- More maintenance overhead

### 4. Current Solution (Conditional Token Decoding)
**Pros:**
- Simple implementation
- Follows existing patterns
- Single code path with environment detection
- Production-like behavior in dev
**Cons:**
- Skips verification in emulator (acceptable for local dev)

## Future Improvements

If Firebase Emulator updates to support "kid" claims in the future, we can:
1. Remove the conditional decoding
2. Use `adminAuth.verifyIdToken()` in all environments
3. Set `FIREBASE_AUTH_EMULATOR_HOST` for Admin SDK

Until then, this solution provides a good balance between development convenience and production security.

## Troubleshooting

### Issue: Still getting "kid" error after fix
**Solution:** Restart your dev server (`npm run dev`) to pick up code changes

### Issue: Stripe checkout works locally but fails in production
**Solution:** Ensure production environment has proper Firebase Admin credentials set

### Issue: Token decoded successfully but Stripe fails with "invalid user"
**Solution:** Check that userId is correctly extracted from token payload

### Issue: Getting "Nicht authentifiziert" error
**Solution:**
- Check that you're logged in
- Verify token is in cookies (DevTools > Application > Cookies)
- Token should be named "firebase-token"

---

**Fixed:** 2025-10-24
**Affects:** Development mode with Firebase Emulator
**Impact:** Enables Stripe checkout testing in local development
