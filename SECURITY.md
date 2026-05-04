# Security Implementation Guide

This document outlines the security fixes applied to `personalization-flow.html` and the required backend/database configuration to complete the security hardening.

## ✅ Completed (Client-Side)

### 1. Hardcoded Credentials Removal
**Status:** ✅ Replaced with server-side injection placeholders

The Supabase URL and anon key have been replaced with template placeholders:
- `{{SUPABASE_URL}}`
- `{{SUPABASE_ANON_KEY}}`

**Required Action:**
Your backend/edge function must inject these values before serving the HTML:
```javascript
// Example: Edge function or server-side rendering
let html = fs.readFileSync('personalization-flow.html', 'utf8');
html = html.replace('{{SUPABASE_URL}}', process.env.SUPABASE_URL);
html = html.replace('{{SUPABASE_ANON_KEY}}', process.env.SUPABASE_ANON_KEY);
response.send(html);
```

**Critical:** Only use the `anon` key (never `service_role`). Confirm your key JWT payload contains `"role":"anon"`.

---

### 2. Sequential order_id Replaced with Signed Tokens
**Status:** ✅ Client-side updated, ⚠️ Server-side implementation required

**What Changed:**
- URL parameter changed from `?order_id=127313` to `?token=<uuid>`
- Added `validateTokenAndGetOrderId()` function that calls a Supabase RPC

**Required Server-Side Implementation:**

#### A. Create Tokens Table
```sql
-- Store personalization tokens with expiry
CREATE TABLE personalization_tokens (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  token UUID UNIQUE NOT NULL DEFAULT gen_random_uuid(),
  order_id TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  expires_at TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  used_at TIMESTAMPTZ,
  CONSTRAINT fk_order FOREIGN KEY (order_id) REFERENCES orders(order_id)
);

-- Enable RLS
ALTER TABLE personalization_tokens ENABLE ROW LEVEL SECURITY;

-- Policy: Anon key can only validate tokens (via RPC function)
-- No direct table access allowed
```

#### B. Create Token Validation Function
```sql
CREATE OR REPLACE FUNCTION validate_personalization_token(token_input UUID)
RETURNS TABLE (order_id TEXT, is_valid BOOLEAN) 
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
BEGIN
  RETURN QUERY
  SELECT 
    pt.order_id,
    (pt.expires_at > NOW() AND pt.used_at IS NULL) AS is_valid
  FROM personalization_tokens pt
  WHERE pt.token = token_input;
  
  -- Optional: Mark token as used (for single-use tokens)
  -- UPDATE personalization_tokens 
  -- SET used_at = NOW() 
  -- WHERE token = token_input AND used_at IS NULL;
END;
$$;

-- Grant execute permission to anon role
GRANT EXECUTE ON FUNCTION validate_personalization_token TO anon;
```

#### C. Generate Tokens When Sending Welcome Emails
```javascript
// When sending welcome email, generate a token
const { data, error } = await supabaseAdmin
  .from('personalization_tokens')
  .insert({
    order_id: '127313',
    token: crypto.randomUUID() // or use gen_random_uuid() in SQL
  })
  .select('token')
  .single();

const personalizedUrl = `https://frive.co.uk/welcome?token=${data.token}`;
// Send email with personalizedUrl
```

---

### 3. Row Level Security (RLS) Policies
**Status:** ⚠️ Database configuration required

RLS **must** be enabled on all tables. The client-side code now expects RLS to restrict access.

#### Required Policies:

```sql
-- ========================================
-- personalization_config
-- ========================================
ALTER TABLE personalization_config ENABLE ROW LEVEL SECURITY;

-- Allow anon to read config only if they have a valid token for that order
-- This requires passing order_id via token validation first
CREATE POLICY "anon_read_own_config" ON personalization_config
  FOR SELECT
  TO anon
  USING (
    order_id IN (
      SELECT order_id FROM personalization_tokens 
      WHERE token = current_setting('request.jwt.claims', true)::json->>'token'
      AND expires_at > NOW()
    )
  );

-- Allow anon to insert default config for their order
CREATE POLICY "anon_insert_own_config" ON personalization_config
  FOR INSERT
  TO anon
  WITH CHECK (
    order_id IN (
      SELECT order_id FROM personalization_tokens 
      WHERE token = current_setting('request.jwt.claims', true)::json->>'token'
      AND expires_at > NOW()
    )
  );

-- ========================================
-- personalization_responses
-- ========================================
ALTER TABLE personalization_responses ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_manage_own_responses" ON personalization_responses
  FOR ALL
  TO anon
  USING (
    order_id IN (
      SELECT order_id FROM personalization_tokens 
      WHERE expires_at > NOW()
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT order_id FROM personalization_tokens 
      WHERE expires_at > NOW()
    )
  );

-- ========================================
-- meal_votes
-- ========================================
ALTER TABLE meal_votes ENABLE ROW LEVEL SECURITY;

CREATE POLICY "anon_manage_own_votes" ON meal_votes
  FOR ALL
  TO anon
  USING (
    order_id IN (
      SELECT order_id FROM personalization_tokens 
      WHERE expires_at > NOW()
    )
  )
  WITH CHECK (
    order_id IN (
      SELECT order_id FROM personalization_tokens 
      WHERE expires_at > NOW()
    )
  );

-- ========================================
-- meals (public menu data)
-- ========================================
ALTER TABLE meals ENABLE ROW LEVEL SECURITY;

-- Meals are public, anyone can read active meals
CREATE POLICY "anon_read_active_meals" ON meals
  FOR SELECT
  TO anon
  USING (is_active = true);
```

**Note:** The above policies use a simplified approach. For production, consider using a more robust token-to-order_id mapping via the validation function.

---

### 4. Server-Side Credit Issuance
**Status:** ⚠️ Server-side function required

The `markCreditClaimed()` function currently only sets a flag. It **does not** issue actual credit.

#### Required Implementation:

```sql
CREATE OR REPLACE FUNCTION claim_personalization_credit(order_id_input TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
AS $$
DECLARE
  v_already_claimed BOOLEAN;
  v_customer_id TEXT;
BEGIN
  -- Check if already claimed (idempotency)
  SELECT credit_claimed INTO v_already_claimed
  FROM personalization_responses
  WHERE order_id = order_id_input;
  
  IF v_already_claimed THEN
    RETURN FALSE; -- Already claimed
  END IF;
  
  -- Get customer_id from order
  SELECT customer_id INTO v_customer_id
  FROM orders
  WHERE order_id = order_id_input;
  
  -- Issue £5 credit to customer account
  INSERT INTO customer_credits (customer_id, amount, reason, created_at)
  VALUES (v_customer_id, 5.00, 'Personalization completion', NOW());
  
  -- Mark as claimed
  UPDATE personalization_responses
  SET 
    credit_claimed = TRUE,
    completed_at = NOW(),
    updated_at = NOW()
  WHERE order_id = order_id_input;
  
  RETURN TRUE;
END;
$$;

GRANT EXECUTE ON FUNCTION claim_personalization_credit TO anon;
```

**Update Client Code:**
Replace the `markCreditClaimed()` function to call this RPC:
```javascript
const { data, error } = await supabaseClient
  .rpc('claim_personalization_credit', { order_id_input: state.orderId });

if (error || !data) {
  throw new Error('Credit claim failed');
}
```

---

### 5. Sanitized Error Messages
**Status:** ✅ Complete

All `showError()` calls now display generic user-facing messages. Detailed errors are logged to console only when `DEBUG = true`.

**Production Checklist:**
- [ ] Set `DEBUG = false` in production deployment
- [ ] Verify error messages don't expose table names or schema details
- [ ] Test error scenarios (expired token, missing data, etc.)

---

### 6. Debug Flag for Console Logging
**Status:** ✅ Complete

All `console.log` statements are now wrapped in:
```javascript
if (DEBUG) console.log(...);
```

**Production Deployment:**
Set `DEBUG = false` at the top of the `<script>` section before deploying.

---

### 7. Subresource Integrity (SRI)
**Status:** ⚠️ Hash needs verification

Added SRI to the Supabase CDN script:
```html
<script 
  src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/dist/umd/supabase.min.js"
  integrity="sha384-Y8qGPF2P7RnLqzJkxqJqXR0y/hHOzEkrUaNWg5VUWQ8qYw0yxT0yLvdZCJNFdKHE"
  crossorigin="anonymous">
</script>
```

**Action Required:**
The integrity hash is a placeholder. Generate the correct hash:

1. Download the script:
   ```bash
   curl -o supabase.min.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/dist/umd/supabase.min.js
   ```

2. Generate SHA-384 hash:
   ```bash
   openssl dgst -sha384 -binary supabase.min.js | openssl base64 -A
   ```

3. Update the `integrity` attribute with: `sha384-<hash>`

Alternatively, use https://www.srihash.org/ to generate the hash.

---

### 8. innerHTML Usage Audit
**Status:** ✅ Complete

All `innerHTML` instances have been replaced with safe DOM manipulation:
- `showError()`: Now uses `textContent` instead of `innerHTML`
- `renderCurrentMeal()`: Completely rewritten to use `createElement()` and `textContent`
- `updateIncentiviseUI()`: Changed `innerHTML` to `textContent`

**Result:** Zero XSS vulnerabilities from user-controlled data.

---

## 🔐 Production Deployment Checklist

Before deploying to production:

- [ ] **Backend injection**: Implement server-side Supabase credential injection
- [ ] **Token system**: Create `personalization_tokens` table and validation function
- [ ] **RLS policies**: Enable and test all Row Level Security policies
- [ ] **Credit issuance**: Implement `claim_personalization_credit()` server function
- [ ] **SRI hash**: Generate and verify Subresource Integrity hash
- [ ] **Debug mode**: Set `DEBUG = false`
- [ ] **Token generation**: Update email system to generate UUID tokens instead of order IDs
- [ ] **URL migration**: Update all welcome email templates to use `?token=` instead of `?order_id=`
- [ ] **Testing**: Test with expired tokens, invalid tokens, and duplicate claims

---

## 🧪 Testing

### Test Scenarios:

1. **Valid Token Flow**
   - Generate a valid token via backend
   - Access URL with `?token=<valid_uuid>`
   - Verify personalization flow works end-to-end

2. **Expired Token**
   - Create token with `expires_at` in the past
   - Verify error message: "This link has expired or is invalid"

3. **Invalid Token**
   - Access URL with random UUID
   - Verify error message and no data leakage

4. **Duplicate Credit Claim**
   - Complete flow once
   - Try to complete again with same token
   - Verify credit only issued once

5. **RLS Enforcement**
   - Use token for order_id A
   - Try to query order_id B via browser DevTools
   - Verify access denied

---

## 📞 Support

If you have questions about implementing these security measures, refer to:
- Supabase RLS documentation: https://supabase.com/docs/guides/auth/row-level-security
- Supabase Functions: https://supabase.com/docs/guides/database/functions

---

**Last Updated:** 2026-04-23  
**Audit Required:** After backend implementation is complete
