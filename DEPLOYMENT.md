# Deployment Guide: Secure Personalization Flow

This guide walks you through deploying the security-hardened personalization flow for Frive.

## 📋 Prerequisites

- Access to Supabase SQL Editor
- Backend/Edge Function deployment capability
- Access to email template system

## 🚀 Deployment Steps

### Step 1: Database Migration (15 minutes)

1. **Open Supabase SQL Editor**
   - Navigate to your Supabase project dashboard
   - Go to SQL Editor

2. **Execute Migration Script**
   - Copy the contents of `supabase-security-migration.sql`
   - Paste into SQL Editor
   - Click "Run"
   - Verify all tables and functions were created successfully

3. **Verify Tables Created**
   ```sql
   SELECT table_name 
   FROM information_schema.tables 
   WHERE table_schema = 'public' 
   AND table_name IN (
     'personalization_tokens',
     'customer_credits',
     'audit_log',
     'error_log'
   );
   ```

4. **Verify Functions Created**
   ```sql
   SELECT routine_name 
   FROM information_schema.routines 
   WHERE routine_schema = 'public' 
   AND routine_name IN (
     'validate_personalization_token',
     'claim_personalization_credit',
     'generate_personalization_token'
   );
   ```

5. **Verify RLS Enabled**
   ```sql
   SELECT tablename, rowsecurity 
   FROM pg_tables 
   WHERE schemaname = 'public' 
   AND tablename IN (
     'personalization_config',
     'personalization_responses',
     'meal_votes',
     'meals',
     'personalization_tokens',
     'customer_credits'
   );
   ```
   All should show `rowsecurity = true`

### Step 2: Generate SRI Hash (5 minutes)

1. **Download Supabase JS Library**
   ```bash
   curl -o supabase.min.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/dist/umd/supabase.min.js
   ```

2. **Generate SHA-384 Hash**
   ```bash
   openssl dgst -sha384 -binary supabase.min.js | openssl base64 -A
   ```

3. **Update HTML File**
   - Open `personalization-flow.html`
   - Find the `<script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/...">` tag
   - Replace the `integrity` attribute value with `sha384-<your_generated_hash>`

### Step 3: Backend Credential Injection (30 minutes)

Choose one of the following approaches:

#### Option A: Supabase Edge Function (Recommended)

1. **Create Edge Function**
   ```typescript
   // supabase/functions/personalization-flow/index.ts
   import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
   
   const HTML_TEMPLATE = await Deno.readTextFile("./personalization-flow.html")
   
   serve(async (req) => {
     const SUPABASE_URL = Deno.env.get("SUPABASE_URL")!
     const SUPABASE_ANON_KEY = Deno.env.get("SUPABASE_ANON_KEY")!
     
     // Inject credentials into HTML
     let html = HTML_TEMPLATE
       .replace('{{SUPABASE_URL}}', SUPABASE_URL)
       .replace('{{SUPABASE_ANON_KEY}}', SUPABASE_ANON_KEY)
     
     return new Response(html, {
       headers: {
         "Content-Type": "text/html; charset=utf-8",
         "Cache-Control": "no-cache, no-store, must-revalidate",
         "X-Content-Type-Options": "nosniff",
         "X-Frame-Options": "DENY",
         "Referrer-Policy": "strict-origin-when-cross-origin"
       }
     })
   })
   ```

2. **Deploy Edge Function**
   ```bash
   supabase functions deploy personalization-flow
   ```

3. **Set Environment Variables**
   ```bash
   supabase secrets set SUPABASE_URL=https://your-project.supabase.co
   supabase secrets set SUPABASE_ANON_KEY=your_anon_key_here
   ```

#### Option B: Node.js Backend

1. **Create Route Handler**
   ```javascript
   // routes/personalization.js
   const fs = require('fs')
   const path = require('path')
   
   app.get('/personalization', (req, res) => {
     let html = fs.readFileSync(
       path.join(__dirname, '../public/personalization-flow.html'), 
       'utf8'
     )
     
     html = html
       .replace('{{SUPABASE_URL}}', process.env.SUPABASE_URL)
       .replace('{{SUPABASE_ANON_KEY}}', process.env.SUPABASE_ANON_KEY)
     
     res.setHeader('Content-Type', 'text/html')
     res.setHeader('Cache-Control', 'no-cache')
     res.setHeader('X-Content-Type-Options', 'nosniff')
     res.send(html)
   })
   ```

2. **Add to .env**
   ```
   SUPABASE_URL=https://your-project.supabase.co
   SUPABASE_ANON_KEY=your_anon_key_here
   ```

### Step 4: Update Email Templates (20 minutes)

1. **Generate Tokens for New Orders**
   
   Update your order creation flow to generate tokens:
   
   ```javascript
   // When creating an order
   const { data: order, error: orderError } = await supabaseAdmin
     .from('orders')
     .insert({ customer_id, /* ... other fields */ })
     .select()
     .single()
   
   // Generate personalization token
   const { data: tokenData } = await supabaseAdmin
     .rpc('generate_personalization_token', {
       order_id_input: order.order_id,
       expiry_days: 7,
       single_use_token: false
     })
   
   const token = tokenData
   ```

2. **Update Email Template**
   
   **Old URL:**
   ```
   https://frive.co.uk/personalization?order_id=127313
   ```
   
   **New URL:**
   ```
   https://frive.co.uk/personalization?token={{personalization_token}}
   ```

3. **Test Email Generation**
   - Create a test order
   - Verify token is generated
   - Check email contains the correct token URL
   - Verify token is valid for 7 days

### Step 5: Migration of Existing Orders (Optional)

If you have existing customers with old URLs:

1. **Generate Tokens for Existing Orders**
   ```sql
   -- Run in Supabase SQL Editor
   INSERT INTO personalization_tokens (order_id, expires_at)
   SELECT 
     order_id,
     NOW() + INTERVAL '30 days' -- Extended expiry for migration
   FROM orders
   WHERE created_at > NOW() - INTERVAL '30 days'
     AND order_id NOT IN (SELECT order_id FROM personalization_tokens)
   RETURNING order_id, token;
   ```

2. **Send Migration Emails**
   - Export the order_id and token pairs
   - Send updated emails with new token URLs
   - Track which customers used the new links

### Step 6: Set Production Config (5 minutes)

1. **Disable Debug Mode**
   - Open `personalization-flow.html`
   - Find `const DEBUG = false;` (line ~1285)
   - Confirm it's set to `false`

2. **Verify All Placeholders Replaced**
   - Search for `{{` in your deployed HTML
   - Ensure no template placeholders remain

### Step 7: Testing (30 minutes)

#### Test Case 1: Valid Token Flow
1. Generate a test token via Supabase
2. Visit URL with token: `?token=<uuid>`
3. Complete personalization flow
4. Verify credit is issued
5. Check `audit_log` table for credit issuance event

#### Test Case 2: Expired Token
1. Create token with past expiry date:
   ```sql
   INSERT INTO personalization_tokens (order_id, expires_at)
   VALUES ('test_order', NOW() - INTERVAL '1 day')
   RETURNING token;
   ```
2. Try to access flow with expired token
3. Should show: "This link has expired or is invalid"

#### Test Case 3: Invalid Token
1. Visit URL with random UUID
2. Should show error message
3. Verify no data leakage in error

#### Test Case 4: Duplicate Credit Claim
1. Complete flow and claim credit
2. Try to access same token again
3. Should show already completed
4. Verify only one credit in `customer_credits` table

#### Test Case 5: RLS Verification
1. Open browser DevTools
2. Try to query another order's data via console:
   ```javascript
   await supabaseClient
     .from('personalization_responses')
     .select('*')
     .eq('order_id', 'another_order_id')
   ```
3. Should return empty or error (RLS blocked)

### Step 8: Monitoring Setup (15 minutes)

1. **Create Dashboard Queries**
   
   **Token Usage:**
   ```sql
   SELECT 
     DATE_TRUNC('day', created_at) as date,
     COUNT(*) as tokens_created,
     COUNT(used_at) as tokens_used,
     COUNT(CASE WHEN expires_at < NOW() THEN 1 END) as expired
   FROM personalization_tokens
   GROUP BY DATE_TRUNC('day', created_at)
   ORDER BY date DESC;
   ```
   
   **Credit Claims:**
   ```sql
   SELECT 
     DATE_TRUNC('day', created_at) as date,
     COUNT(*) as credits_issued,
     SUM(amount) as total_amount
   FROM customer_credits
   WHERE reason = 'Personalization flow completion'
   GROUP BY DATE_TRUNC('day', created_at)
   ORDER BY date DESC;
   ```
   
   **Error Monitoring:**
   ```sql
   SELECT 
     error_type,
     COUNT(*) as count,
     MAX(created_at) as last_occurrence
   FROM error_log
   WHERE created_at > NOW() - INTERVAL '24 hours'
   GROUP BY error_type
   ORDER BY count DESC;
   ```

2. **Set Up Alerts**
   - Monitor `error_log` for spikes
   - Alert on failed credit claims
   - Track token validation failures

## ✅ Post-Deployment Checklist

- [ ] Database migration completed successfully
- [ ] All RLS policies enabled and tested
- [ ] SRI hash generated and updated
- [ ] Backend credential injection working
- [ ] Email templates updated with token URLs
- [ ] DEBUG mode disabled in production
- [ ] All test cases passed
- [ ] Monitoring dashboards created
- [ ] Team trained on new security measures
- [ ] Documentation updated

## 🔄 Rollback Plan

If issues occur:

1. **Immediate Actions:**
   - Disable the new endpoint/edge function
   - Re-enable old endpoint with order_id
   - Monitor for continued issues

2. **Database Rollback:**
   ```sql
   -- Disable RLS temporarily if needed
   ALTER TABLE personalization_responses DISABLE ROW LEVEL SECURITY;
   ALTER TABLE personalization_config DISABLE ROW LEVEL SECURITY;
   ALTER TABLE meal_votes DISABLE ROW LEVEL SECURITY;
   
   -- Re-enable after fix
   ```

3. **Notify Team:**
   - Email customers who may have experienced issues
   - Provide manual credit issuance if needed

## 📞 Support

Issues? Check:
1. Supabase logs in Dashboard > Logs
2. `error_log` table for application errors
3. Browser DevTools console (if DEBUG enabled)
4. `audit_log` for credit issuance issues

## 🎉 Success Metrics

Monitor these after deployment:
- Token validation success rate (should be >95%)
- Credit claim success rate (should be >99%)
- Average time to complete flow
- RLS policy enforcement (no unauthorized access)
- Error rate (should be <1%)

---

**Deployment Date:** _________________  
**Deployed By:** _________________  
**Verified By:** _________________
