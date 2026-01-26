# Naruvia Monetization Plan (NewebPay Edition)
> Created: 2026-01-26
> Status: Planning
> Target: MVP Validation (Personal Identity)

## 1. Strategy: The "Access Pass" Model
Since we are operating as an individual entity (No Company) and want to validate the market quickly, we will avoid complex "Auto-renewing Subscriptions" which require high technical overhead and specific banking permissions in Taiwan.

Instead, we will implement a **Time-based Access Pass** model (Pre-paid / Top-up).
- Users buy a "30 Run Pass" or "30 Day Pass".
- Payment is a **One-time Transaction**.
- System grants access until `current_period_end`.
- When expired, user manually pays again to extend.

**Benefits:**
- **Zero Risk**: No handling of credit card tokens or recurring logic.
- **Easy Approval**: NewebPay Personal accounts support one-time payments natively.
- **Low Fee**: 2.8% (Credit Card) vs 5%+ (International MoR).

## 2. Infrastructure: NewebPay (藍新金流)

We will use **NewebPay MPG (Multi-Payment Gateway)** API.

### Workflow
1.  **Order Creation**: User selects a plan on Naruvia.
2.  **Form Submission**: Backend generates a signed HTML Form and auto-submits it to NewebPay.
3.  **Payment**: User enters card details on NewebPay's hosted page.
4.  **Callback (NotifyURL)**: NewebPay sends a backend webhook (POST) to Naruvia with payment result.
5.  **Grant Access**: Naruvia validates the checksum and updates user's expiry date.

## 3. Database Schema Changes (Prisma)

We need to store orders and entitlement validity.

```prisma
// Update User Model to track entitlement
model User {
  // ... existing fields
  isPro           Boolean  @default(false) @map("is_pro")
  proExpiresAt    DateTime? @map("pro_expires_at") // The simplified "Subscription" check
  
  orders          Order[]
}

// New Order Model (Transaction History)
model Order {
  id              String   @id @default(uuid()) @db.Uuid
  userId          String   @map("user_id") @db.Uuid
  
  // NewebPay Specific Fields
  merchantOrderNo String   @unique @map("merchant_order_no") // Unique ID sent to NewebPay (e.g., TS_123456)
  amount          Int
  itemDesc        String   @map("item_desc")
  
  // Status Tracking
  status          OrderStatus @default(PENDING)
  paymentType     String?     @map("payment_type") // CRED, ATM, etc.
  paidAt          DateTime?   @map("paid_at")
  
  // Raw response for audit
  gatewayResponse Json?    @map("gateway_response") @db.Json
  
  user            User     @relation(fields: [userId], references: [id])
  createdAt       DateTime @default(now()) @map("created_at")
  updatedAt       DateTime @updatedAt @map("updated_at")

  @@map("orders")
}

enum OrderStatus {
  PENDING
  PAID
  FAILED
  REFUNDED
}
```

## 4. API Architecture

### A. `POST /api/payment/newebpay/create`
- **Input**: `planId` (e.g., "monthly_99")
- **Logic**:
    1.  Create `Order` record in DB with status `PENDING`.
    2.  Generate AES encrypted `TradeInfo` and `TradeSha` hash required by NewebPay.
    3.  Return HTML fragment that auto-submits the form to NewebPay.

### B. `POST /api/payment/newebpay/callback`
- **Purpose**: Receive payment confirmation from NewebPay (server-to-server).
- **Logic**:
    1.  Decrypt the payload using HashKey/HashIV.
    2.  Verify `Status === 'SUCCESS'`.
    3.  Find `Order` by `MerchantOrderNo`.
    4.  Update Order status to `PAID`.
    5.  **Entitlement Logic**:
        - If `plan == monthly`, set `User.proExpiresAt = NOW + 30 Days`.
        - If user is already active, `User.proExpiresAt = OldExpiry + 30 Days` (Stacking).

### C. `POST /api/payment/newebpay/return` (Optional)
- **Purpose**: The page user sees after payment.
- **Logic**: Redirect user back to `/settings` or `/success` page.

## 5. Security & Configuration
We need to store sensitive keys in `.env.local`:
```env
NEWEBPAY_MERCHANT_ID=
NEWEBPAY_HASH_KEY=
NEWEBPAY_HASH_IV=
NEWEBPAY_API_URL=https://ccore.newebpay.com/MPG/mpg_gateway (Prod) or https://ccore.newebpay.com/MPG/mpg_gateway (Test)
```

## 6. Implementation Steps

### Phase 1: Preparation
- [ ] Register NewebPay Personal Account.
- [ ] Get Test MerchantID, HashKey, HashIV.
- [ ] Implement `NewebPayService` to handle Encryption (AES-256-CBC) and SHA-256 hashing.

### Phase 2: Backend Core
- [ ] Update Prisma Schema (`Order`, `User` fields).
- [ ] Create `/api/payment/newebpay` endpoints.

### Phase 3: Frontend
- [ ] Create "Pricing Card" UI.
- [ ] Handle the form submission (NewebPay requires a form POST, often handled by rendering a hidden form and `form.submit()`).

### Phase 4: Validation
- [ ] Test simulation with NewebPay Test Cards.
- [ ] Verify database updates.
