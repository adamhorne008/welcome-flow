# Welcome Flow

A personalized onboarding questionnaire for Frive customers. This flow collects dietary preferences, health goals, split box preferences, and meal ratings to personalize the customer experience.

## ⚠️ SECURITY UPDATE (2026-04-23)

**This project has undergone comprehensive security hardening.** Before deploying to production, please review:

- 📋 **[SECURITY_SUMMARY.md](./SECURITY_SUMMARY.md)** - Overview of security fixes
- 🚀 **[DEPLOYMENT.md](./DEPLOYMENT.md)** - Step-by-step deployment guide
- 🔐 **[SECURITY.md](./SECURITY.md)** - Detailed technical documentation
- ⚡ **[SECURITY_QUICK_REF.md](./SECURITY_QUICK_REF.md)** - Quick reference guide

**Key Changes:**
- ✅ Hardcoded credentials removed (requires server-side injection)
- ✅ Sequential order_id replaced with UUID tokens
- ✅ Row Level Security (RLS) enabled on all tables
- ✅ Server-side credit issuance with fraud prevention
- ✅ Error message sanitization
- ✅ Debug logging protection
- ✅ Subresource Integrity (SRI) for CDN scripts
- ✅ XSS protection via safe DOM methods

**⚠️ Breaking Changes:**
- URL parameter changed from `?order_id=127313` to `?token=<uuid>`
- Backend implementation required before deployment
- Database migration required (see `supabase-security-migration.sql`)

---

## 🎯 Features

- **Dietary Preferences**: Capture customer food preferences (vegan, vegetarian, dairy-free, etc.)
- **Health Goals**: 6 goal options (improve health, build muscle, lose weight, increase energy, improve gut health, support GLP-1)
- **Split Box Question**: For large orders, offer option to split delivery across two days
- **Meal Voting**: Rate 10 personalized meals with thumbs up/down
- **Conditional Incentivization**: Toggle £5 credit messaging on/off
- **Success Screen**: Thank you message with benefits showcase (Freya AI, Rewards, App)
- **🔒 Security**: Token-based authentication, RLS policies, server-side validation

## 🚀 Getting Started

### Prerequisites

- Supabase account and project
- Backend or edge function capability (for credential injection)
- Node.js (for SRI hash generation)

### Installation

1. Clone the repository:
```bash
git clone https://github.com/adamhorne008/welcome-flow.git
cd welcome-flow
```

2. **Run database migration** (CRITICAL):
   - Open Supabase SQL Editor
   - Execute contents of `supabase-security-migration.sql`
   - Verify all tables and functions created

3. **Generate SRI hash** (see [DEPLOYMENT.md](./DEPLOYMENT.md) Step 2)

4. **Set up credential injection** (see [DEPLOYMENT.md](./DEPLOYMENT.md) Step 3)

5. **Update email templates** to generate and use tokens (see [DEPLOYMENT.md](./DEPLOYMENT.md) Step 4)

6. Test with token parameter:
```
personalization-flow.html?token=a1b2c3d4-e5f6-7890-abcd-ef1234567890
```

## 📊 Database Setup

**Required tables:**
- `personalization_tokens` - UUID tokens with expiry
- `personalization_config` - Order configuration
- `personalization_responses` - Customer responses
- `meal_votes` - Individual meal ratings
- `meals` - Menu items
- `customer_credits` - Credit issuance tracking
- `audit_log` - Security audit trail
- `error_log` - Error monitoring

**Setup:** Execute `supabase-security-migration.sql` in Supabase SQL Editor

## 🎯 URL Parameters

- ~~`order_id`~~ **DEPRECATED** - Replaced with token-based auth
- `token` (required): UUID token generated server-side (expires in 7 days)

## 🔐 Security Features

- **Token-based Access**: UUID tokens prevent enumeration attacks
- **Row Level Security**: Supabase RLS policies restrict data access
- **Server-side Validation**: Credit issuance validated server-side with idempotency
- **Error Sanitization**: Generic user-facing messages prevent info disclosure
- **Debug Protection**: Console logging gated behind DEBUG flag
- **SRI Protection**: Subresource Integrity prevents CDN tampering
- **XSS Prevention**: Safe DOM methods throughout

## 📱 Responsive Design

- Mobile-first design
- Max-width 500px on desktop
- Touch-friendly UI

Built with ❤️ for Frive
