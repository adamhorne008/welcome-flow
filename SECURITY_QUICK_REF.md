# Security Fixes Quick Reference

## 🔒 What Changed?

### 1. **Hardcoded Credentials → Server-Side Injection**
- **Before:** `const SUPABASE_URL = 'https://...'`
- **After:** `const SUPABASE_URL = '{{SUPABASE_URL}}'`
- **Action Required:** Backend must inject credentials before serving HTML

### 2. **Sequential order_id → UUID Tokens**
- **Before:** `?order_id=127313` (enumerable, insecure)
- **After:** `?token=a1b2c3d4-e5f6-7890-abcd-ef1234567890`
- **Action Required:** Generate tokens when sending welcome emails

### 3. **Row Level Security (RLS)**
- **Before:** No RLS, anyone could access any order's data
- **After:** RLS enabled on all tables, access restricted by token
- **Action Required:** Run `supabase-security-migration.sql`

### 4. **Client-Side Credit → Server-Side Function**
- **Before:** Client sets `credit_claimed = true` (easily exploited)
- **After:** Server function validates and issues credit with idempotency
- **Action Required:** Update client to call `claim_personalization_credit()` RPC

### 5. **Detailed Errors → Generic Messages**
- **Before:** `"Database connection failed: permission denied on table personalization_responses"`
- **After:** `"Something went wrong. Please try again."`
- **Action Required:** None (automatic)

### 6. **console.log Everywhere → DEBUG Flag**
- **Before:** `console.log('Order ID:', orderId)` always runs
- **After:** `if (DEBUG) console.log('Order ID:', orderId)`
- **Action Required:** Set `DEBUG = false` in production

### 7. **No SRI → Subresource Integrity**
- **Before:** `<script src="...@supabase/supabase-js@2">`
- **After:** `<script src="...@2.47.10" integrity="sha384-..." crossorigin="anonymous">`
- **Action Required:** Generate correct SRI hash (see DEPLOYMENT.md)

### 8. **innerHTML → Safe DOM Methods**
- **Before:** `container.innerHTML = \`<h3>${meal.name}</h3>\``
- **After:** DOM methods with `textContent` (XSS-safe)
- **Action Required:** None (automatic)

---

## 📁 New Files

| File | Purpose |
|------|---------|
| `SECURITY.md` | Detailed security documentation |
| `supabase-security-migration.sql` | Database migration script |
| `DEPLOYMENT.md` | Step-by-step deployment guide |
| `SECURITY_QUICK_REF.md` | This file |

---

## ⚡ Quick Deploy Commands

```bash
# 1. Generate SRI hash
curl -o supabase.min.js https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2.47.10/dist/umd/supabase.min.js
openssl dgst -sha384 -binary supabase.min.js | openssl base64 -A

# 2. Run migration in Supabase SQL Editor
# (Copy contents of supabase-security-migration.sql)

# 3. Deploy edge function (if using Supabase Functions)
supabase functions deploy personalization-flow

# 4. Set secrets
supabase secrets set SUPABASE_URL=https://your-project.supabase.co
supabase secrets set SUPABASE_ANON_KEY=your_anon_key
```

---

## 🧪 Test URLs

### Development
```
http://localhost:3000/personalization?token=test-uuid-here
```

### Production
```
https://frive.co.uk/personalization?token=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

---

## 🐛 Common Issues & Fixes

### Issue: "Configuration Error"
**Cause:** Supabase credentials not injected  
**Fix:** Check backend injection code is running

### Issue: "Invalid or expired link"
**Cause:** Token doesn't exist or has expired  
**Fix:** Generate new token via `generate_personalization_token()`

### Issue: "Something went wrong"
**Cause:** Various (check logs)  
**Fix:** 
1. Set `DEBUG = true` temporarily
2. Check browser console
3. Check Supabase logs
4. Check `error_log` table

### Issue: RLS denying access
**Cause:** RLS policies too restrictive  
**Fix:** Verify token validation is working, check policies

---

## 📊 Monitoring Queries

### Check Token Usage
```sql
SELECT 
  COUNT(*) FILTER (WHERE used_at IS NOT NULL) as used,
  COUNT(*) FILTER (WHERE expires_at > NOW()) as active,
  COUNT(*) FILTER (WHERE expires_at < NOW()) as expired
FROM personalization_tokens;
```

### Check Credit Claims
```sql
SELECT 
  DATE(created_at) as date,
  COUNT(*) as claims,
  SUM(amount) as total_gbp
FROM customer_credits
WHERE reason = 'Personalization flow completion'
  AND created_at > NOW() - INTERVAL '7 days'
GROUP BY DATE(created_at)
ORDER BY date DESC;
```

### Check Errors
```sql
SELECT error_type, COUNT(*), MAX(created_at) as last_seen
FROM error_log
WHERE created_at > NOW() - INTERVAL '1 day'
GROUP BY error_type;
```

---

## 🔐 Security Best Practices

### DO ✅
- Always use tokens, never order_id in URLs
- Generate tokens server-side with proper expiry
- Use RLS policies on all tables
- Log credit issuance events
- Monitor error_log and audit_log tables
- Set DEBUG = false in production
- Rotate credentials if leaked

### DON'T ❌
- Expose order_id in URLs or client-side code
- Trust client-side flags (e.g., credit_claimed)
- Use innerHTML with user/database data
- Show detailed errors to end users
- Deploy with hardcoded credentials
- Grant service_role key to client-side code
- Skip RLS policy testing

---

## 🆘 Emergency Contacts

| Issue | Contact |
|-------|---------|
| Database down | Supabase Support |
| Security incident | Security Team Lead |
| Customer credit issues | Finance Team |
| Deployment issues | DevOps Team |

---

## 📚 Further Reading

- [Supabase RLS Guide](https://supabase.com/docs/guides/auth/row-level-security)
- [OWASP Top 10](https://owasp.org/www-project-top-ten/)
- [JWT Best Practices](https://auth0.com/blog/a-look-at-the-latest-draft-for-jwt-bcp/)
- [SRI Documentation](https://developer.mozilla.org/en-US/docs/Web/Security/Subresource_Integrity)

---

**Last Updated:** 2026-04-23  
**Version:** 1.0.0
