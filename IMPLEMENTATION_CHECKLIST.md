# Security Implementation Checklist

Use this checklist to track progress on implementing the security fixes for the Frive personalization flow.

## 📋 Pre-Deployment Tasks

### Phase 1: Database Setup (Est. 15 min)
- [ ] Open Supabase project dashboard
- [ ] Navigate to SQL Editor
- [ ] Copy contents of `supabase-security-migration.sql`
- [ ] Execute migration script
- [ ] Verify tables created:
  - [ ] `personalization_tokens`
  - [ ] `customer_credits`
  - [ ] `audit_log`
  - [ ] `error_log`
- [ ] Verify functions created:
  - [ ] `validate_personalization_token()`
  - [ ] `claim_personalization_credit()`
  - [ ] `generate_personalization_token()`
- [ ] Verify RLS enabled on all tables
- [ ] Test token generation:
  ```sql
  SELECT generate_personalization_token('test_order_123', 7, false);
  ```
- [ ] Test token validation:
  ```sql
  SELECT * FROM validate_personalization_token('<token_from_above>');
  ```

**Sign-off:** ______________ Date: ______________

---

### Phase 2: SRI Hash Generation (Est. 5 min)
- [ ] Download Supabase JS library:
  ```bash
  curl -o supabase.min.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/dist/umd/supabase.min.js
  ```
- [ ] Generate SHA-384 hash:
  ```bash
  openssl dgst -sha384 -binary supabase.min.js | openssl base64 -A
  ```
- [ ] Update `personalization-flow.html` with correct hash
- [ ] Verify format: `sha384-<hash_value>`
- [ ] Test CDN script loads successfully

**Hash Generated:** `sha384-________________________________`  
**Sign-off:** ______________ Date: ______________

---

### Phase 3: Backend Credential Injection (Est. 30 min)

#### Option A: Supabase Edge Function
- [ ] Create edge function directory structure
- [ ] Implement credential injection logic
- [ ] Copy `personalization-flow.html` to function directory
- [ ] Deploy function:
  ```bash
  supabase functions deploy personalization-flow
  ```
- [ ] Set environment secrets:
  ```bash
  supabase secrets set SUPABASE_URL=<url>
  supabase secrets set SUPABASE_ANON_KEY=<key>
  ```
- [ ] Test function returns HTML with injected credentials
- [ ] Verify no `{{` placeholders remain in response

#### Option B: Node.js/Express Backend
- [ ] Create route handler for `/personalization`
- [ ] Implement credential injection logic
- [ ] Add `.env` file with credentials
- [ ] Add `.env` to `.gitignore`
- [ ] Test route returns HTML with injected credentials
- [ ] Verify no `{{` placeholders remain in response

**Implementation Method:** [ ] Edge Function [ ] Backend  
**Endpoint URL:** ________________________________  
**Sign-off:** ______________ Date: ______________

---

### Phase 4: Email Template Updates (Est. 20 min)
- [ ] Identify welcome email template(s)
- [ ] Update order creation flow to generate tokens:
  ```javascript
  const { data } = await supabaseAdmin
    .rpc('generate_personalization_token', {
      order_id_input: order.order_id,
      expiry_days: 7,
      single_use_token: false
    });
  const token = data;
  ```
- [ ] Update email template URL from:
  - Old: `?order_id={{order_id}}`
  - New: `?token={{personalization_token}}`
- [ ] Test token generation on new order
- [ ] Test email contains valid token URL
- [ ] Verify token expires in 7 days

**Template Updated:** ________________________________  
**Test Order ID:** ________________________________  
**Test Token:** ________________________________  
**Sign-off:** ______________ Date: ______________

---

### Phase 5: Production Configuration (Est. 5 min)
- [ ] Open deployed `personalization-flow.html`
- [ ] Verify `DEBUG = false` (line ~1285)
- [ ] Verify SRI hash is correct
- [ ] Verify credentials injected (no `{{` in source)
- [ ] Search for `console.log` - all should be wrapped in `if (DEBUG)`
- [ ] Search for `.innerHTML` - should be minimal/safe

**Sign-off:** ______________ Date: ______________

---

## 🧪 Testing Phase

### Test 1: Valid Token Flow (Est. 5 min)
- [ ] Generate test token via backend
- [ ] Access URL: `?token=<valid_uuid>`
- [ ] Complete dietary preferences selection
- [ ] Complete health goals selection (if enabled)
- [ ] Complete split box selection (if enabled)
- [ ] Rate all 10 meals
- [ ] Verify credit claimed successfully
- [ ] Check `customer_credits` table for new entry
- [ ] Check `audit_log` for credit issuance event

**Test Token:** ________________________________  
**Test Order ID:** ________________________________  
**Result:** [ ] PASS [ ] FAIL  
**Notes:** ________________________________  
**Tester:** ______________ Date: ______________

---

### Test 2: Expired Token (Est. 3 min)
- [ ] Create token with past expiry:
  ```sql
  INSERT INTO personalization_tokens (order_id, expires_at)
  VALUES ('expired_test', NOW() - INTERVAL '1 day')
  RETURNING token;
  ```
- [ ] Access URL with expired token
- [ ] Verify error: "This link has expired or is invalid"
- [ ] Verify flow does not load
- [ ] Verify no console errors (if DEBUG=false)

**Test Token:** ________________________________  
**Result:** [ ] PASS [ ] FAIL  
**Tester:** ______________ Date: ______________

---

### Test 3: Invalid Token (Est. 2 min)
- [ ] Access URL with random UUID
- [ ] Verify error message shown
- [ ] Verify no data loaded
- [ ] Verify no schema information in error message
- [ ] Open DevTools, check console (if DEBUG=true)

**Test Token:** ________________________________  
**Result:** [ ] PASS [ ] FAIL  
**Tester:** ______________ Date: ______________

---

### Test 4: Duplicate Credit Claim (Est. 5 min)
- [ ] Complete valid token flow (claim credit once)
- [ ] Note credit amount in `customer_credits`
- [ ] Access same URL again
- [ ] Verify flow shows "already completed"
- [ ] Verify no duplicate credit in `customer_credits`
- [ ] Check `audit_log` - only one credit event

**Test Token:** ________________________________  
**Credits Before:** __________ **After:** __________  
**Result:** [ ] PASS [ ] FAIL  
**Tester:** ______________ Date: ______________

---

### Test 5: RLS Enforcement (Est. 5 min)
- [ ] Open browser DevTools console
- [ ] Get valid token for order A
- [ ] Try to query order B's data:
  ```javascript
  await supabaseClient
    .from('personalization_responses')
    .select('*')
    .eq('order_id', 'different_order_id')
  ```
- [ ] Verify returns empty or error
- [ ] Repeat for other tables:
  - [ ] `personalization_config`
  - [ ] `meal_votes`
- [ ] Verify cannot access other orders' data

**Result:** [ ] PASS [ ] FAIL  
**Tester:** ______________ Date: ______________

---

### Test 6: Error Message Sanitization (Est. 5 min)
- [ ] Trigger various error scenarios:
  - [ ] Network error (disconnect internet)
  - [ ] Invalid data format
  - [ ] Missing required field
- [ ] Verify all errors show generic message
- [ ] Verify no table names exposed
- [ ] Verify no schema hints exposed
- [ ] Check console (if DEBUG=true) for detailed errors

**Result:** [ ] PASS [ ] FAIL  
**Tester:** ______________ Date: ______________

---

### Test 7: Cross-Browser Testing (Est. 10 min)
- [ ] Chrome/Edge (desktop)
- [ ] Firefox (desktop)
- [ ] Safari (desktop)
- [ ] Chrome (mobile)
- [ ] Safari (iOS)
- [ ] Verify SRI loads successfully in all browsers
- [ ] Verify flow works end-to-end

**All Browsers Pass:** [ ] YES [ ] NO  
**Issues:** ________________________________  
**Tester:** ______________ Date: ______________

---

## 📊 Monitoring Setup (Est. 15 min)

### Dashboard Creation
- [ ] Create Supabase dashboard or external monitoring
- [ ] Add query: Token usage (created/used/expired)
- [ ] Add query: Credit claims (daily count, total amount)
- [ ] Add query: Error rates (last 24h, by type)
- [ ] Add query: Token validation success rate
- [ ] Set up alerts for:
  - [ ] Error rate >5%
  - [ ] Token validation rate <90%
  - [ ] Duplicate credit attempts
  - [ ] RLS policy violations

**Dashboard URL:** ________________________________  
**Sign-off:** ______________ Date: ______________

---

## 🚀 Go-Live Checklist

### Pre-Launch Verification
- [ ] All Phase 1-5 tasks completed
- [ ] All tests (1-7) passed
- [ ] Monitoring dashboards active
- [ ] Rollback plan documented
- [ ] Team trained on new system
- [ ] Support team briefed on changes
- [ ] Customer communication prepared (if needed)

### Launch
- [ ] Deploy backend/edge function to production
- [ ] Update DNS/routing (if needed)
- [ ] Monitor error logs for first hour
- [ ] Monitor token usage
- [ ] Monitor credit claims
- [ ] Test production URL with real token

### Post-Launch (First 24 Hours)
- [ ] Check error log every 2 hours
- [ ] Verify token generation working
- [ ] Verify credit claims processing correctly
- [ ] Check for RLS violations (should be zero)
- [ ] Monitor customer feedback
- [ ] Document any issues

**Go-Live Date:** ________________________________  
**Go-Live Time:** ________________________________  
**Deployed By:** ______________ Date: ______________  
**Verified By:** ______________ Date: ______________

---

## 📝 Post-Launch Report

### Success Metrics (After 7 Days)
- Token validation success rate: ________%
- Credit claim success rate: ________%
- Average completion time: ________ minutes
- Error rate: ________%
- RLS violations: ________
- Customer complaints: ________

### Issues Encountered
________________________________
________________________________
________________________________

### Lessons Learned
________________________________
________________________________
________________________________

**Report Compiled By:** ______________ Date: ______________

---

## ✅ Final Sign-Off

I confirm that all security fixes have been implemented, tested, and are functioning correctly in production.

**Technical Lead:** ______________ Date: ______________  
**Security Lead:** ______________ Date: ______________  
**Product Owner:** ______________ Date: ______________

---

**Document Version:** 1.0  
**Last Updated:** 2026-04-23
