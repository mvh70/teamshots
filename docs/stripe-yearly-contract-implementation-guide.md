# Stripe Implementation Guide: Yearly Contracts with Monthly Billing + Credit Top-Ups

## Overview

This guide covers implementing a complete subscription system with:
1. **Yearly contracts with monthly billing** - 12-month commitment, billed monthly
2. **Credit top-up system** - One-time purchases for additional credits
3. **Upgrade/downgrade flows** - Managing plan changes during contracts

## Business Requirements

### Subscription System
- **Contract Term**: 12 months
- **Billing Frequency**: Monthly
- **Downgrades**: Only take effect at the end of the contract term (after 12 months)
- **Upgrades**: Can happen immediately with prorated billing
- **Cancellation**: Customer commits to full 12 months of payments

### Credit Top-Up System
- **One-time purchases**: Buy credits anytime, independent of subscription
- **Variable pricing**: Different packages with bulk discounts
- **Immediate payment**: Charged right away, not added to monthly bill
- **Credit tracking**: Balance stored in your database

## Technical Approach

We'll use **Stripe Subscription Schedules** because they allow us to:
- Define a 12-month commitment period
- Bill monthly within that period
- Schedule changes to occur at specific times
- Enforce contract terms

## Implementation Steps

### 1. Create Product and Price in Stripe

You have two options for creating products and prices:

#### Option A: Manual Creation via Stripe Dashboard

1. Go to **Products** in your Stripe Dashboard
2. Create a product (e.g., "Premium Plan")
3. Add a **monthly recurring price** (e.g., $99/month)
4. Note the `price_id` (looks like `price_xxxxx`)

#### Option B: Automatic Creation via API (Recommended for Consistency)

For better consistency and version control, you can create products and prices programmatically:

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function setupStripeProducts() {
  try {
    // Define your product structure
    const productConfigs = [
      {
        name: 'Premium Plan',
        description: 'Full access to all features with 500 credits/month',
        monthlyPrice: 9900, // $99.00 in cents
        credits: 500,
      },
      {
        name: 'Basic Plan',
        description: 'Essential features with 100 credits/month',
        monthlyPrice: 2900, // $29.00 in cents
        credits: 100,
      },
    ];

    const createdProducts = [];

    for (const config of productConfigs) {
      // Create product with price in one call
      const product = await stripe.products.create({
        name: config.name,
        description: config.description,
        metadata: {
          monthly_credits: config.credits.toString(),
          plan_type: 'subscription',
        },
      });

      // Create the monthly recurring price
      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: config.monthlyPrice,
        currency: 'usd',
        recurring: {
          interval: 'month',
        },
        metadata: {
          credits_included: config.credits.toString(),
        },
      });

      createdProducts.push({
        productId: product.id,
        priceId: price.id,
        name: config.name,
      });

      console.log(`✓ Created ${config.name}: ${price.id}`);
    }

    return createdProducts;
  } catch (error) {
    console.error('Error creating products:', error);
    throw error;
  }
}

// Also create credit top-up packages
async function setupCreditPackages() {
  try {
    const creditPackages = [
      { credits: 100, price: 1500, name: '100 Credits' },
      { credits: 500, price: 6000, name: '500 Credits' },
      { credits: 1000, price: 10000, name: '1,000 Credits' },
      { credits: 5000, price: 40000, name: '5,000 Credits' },
    ];

    const createdPackages = [];

    for (const pkg of creditPackages) {
      const product = await stripe.products.create({
        name: pkg.name,
        description: `One-time purchase of ${pkg.credits} credits`,
        metadata: {
          credits_amount: pkg.credits.toString(),
          package_type: 'credit_topup',
        },
      });

      const price = await stripe.prices.create({
        product: product.id,
        unit_amount: pkg.price,
        currency: 'usd',
        metadata: {
          credits: pkg.credits.toString(),
        },
      });

      createdPackages.push({
        productId: product.id,
        priceId: price.id,
        credits: pkg.credits,
      });

      console.log(`✓ Created ${pkg.name} package: ${price.id}`);
    }

    return createdPackages;
  } catch (error) {
    console.error('Error creating credit packages:', error);
    throw error;
  }
}

// Run setup (do this once during initialization)
async function initializeStripeProducts() {
  console.log('Setting up Stripe products...');
  
  const products = await setupStripeProducts();
  const creditPackages = await setupCreditPackages();
  
  console.log('\n✅ Setup complete! Save these IDs to your .env file:\n');
  
  products.forEach(p => {
    console.log(`PRICE_${p.name.toUpperCase().replace(/\s+/g, '_')}_MONTHLY=${p.priceId}`);
  });
  
  creditPackages.forEach(p => {
    console.log(`PRICE_${p.credits}_CREDITS=${p.priceId}`);
  });
}

// Usage:
// initializeStripeProducts();
```

**Using Stripe CLI (Alternative):**

You can also use the Stripe CLI for quick setup:

```bash
# Create Premium Plan
stripe products create \
  --name="Premium Plan" \
  --description="Full access with 500 credits/month"

# Create monthly price for Premium (use product ID from above)
stripe prices create \
  --product="prod_xxxxx" \
  --unit-amount=9900 \
  --currency=usd \
  --recurring[interval]=month

# Create credit package
stripe products create \
  --name="1000 Credits" \
  --description="One-time purchase"

stripe prices create \
  --product="prod_yyyyy" \
  --unit-amount=10000 \
  --currency=usd
```

**Infrastructure as Code (Terraform):**

For production environments, consider using Terraform:

```hcl
resource "stripe_product" "premium" {
  name        = "Premium Plan"
  description = "Full access with 500 credits/month"
  
  metadata = {
    monthly_credits = "500"
    plan_type      = "subscription"
  }
}

resource "stripe_price" "premium_monthly" {
  product     = stripe_product.premium.id
  unit_amount = 9900
  currency    = "usd"
  
  recurring {
    interval = "month"
  }
  
  metadata = {
    credits_included = "500"
  }
}
```

**Benefits of Automatic Setup:**
- ✅ Consistent across environments (dev, staging, production)
- ✅ Version controlled and auditable
- ✅ Easy to replicate and update
- ✅ Can be part of your CI/CD pipeline
- ✅ No manual errors or typos
- ✅ Bulk creation for multiple plans

### 2. Create a New Subscription with 12-Month Contract

```javascript
const stripe = require('stripe')(process.env.STRIPE_SECRET_KEY);

async function createYearlyContractSubscription(customerId, monthlyPriceId) {
  try {
    const subscriptionSchedule = await stripe.subscriptionSchedules.create({
      customer: customerId,
      start_date: 'now',
      end_behavior: 'release', // Release from schedule after 12 months
      phases: [
        {
          items: [
            {
              price: monthlyPriceId,
              quantity: 1,
            },
          ],
          iterations: 12, // 12 monthly billing cycles = 1 year contract
        },
      ],
      metadata: {
        contract_type: 'annual',
        contract_start: new Date().toISOString(),
        contract_end: new Date(Date.now() + 365 * 24 * 60 * 60 * 1000).toISOString(),
      },
    });

    console.log('Subscription Schedule created:', subscriptionSchedule.id);
    return subscriptionSchedule;
  } catch (error) {
    console.error('Error creating subscription:', error);
    throw error;
  }
}
```

**Key Parameters:**
- `iterations: 12` = 12 monthly billing periods
- `end_behavior: 'release'` = After 12 months, subscription continues normally
- `metadata` = Store contract dates for reference

### 3. Handle Upgrades (Immediate)

When a customer wants to upgrade to a higher tier, apply the change immediately with proration:

```javascript
async function upgradeSubscription(subscriptionId, newPriceId) {
  try {
    // Get the current subscription
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    
    // Update with new price - Stripe handles proration automatically
    const updatedSubscription = await stripe.subscriptions.update(subscriptionId, {
      items: [
        {
          id: subscription.items.data[0].id,
          price: newPriceId,
        },
      ],
      proration_behavior: 'always_invoice', // Charge immediately for upgrade
    });

    console.log('Subscription upgraded:', updatedSubscription.id);
    return updatedSubscription;
  } catch (error) {
    console.error('Error upgrading subscription:', error);
    throw error;
  }
}
```

### 4. Handle Downgrades (End of Contract Only)

Downgrades should only happen after the 12-month contract ends. Here's how to implement this:

```javascript
async function requestDowngrade(subscriptionId, newLowerPriceId) {
  try {
    // Get subscription to check contract end date
    const subscription = await stripe.subscriptions.retrieve(subscriptionId);
    const schedule = subscription.schedule 
      ? await stripe.subscriptionSchedules.retrieve(subscription.schedule)
      : null;

    // Check if still in contract period
    const contractEndDate = subscription.metadata?.contract_end;
    const now = new Date();
    const isInContractPeriod = contractEndDate && new Date(contractEndDate) > now;

    if (isInContractPeriod) {
      // Schedule downgrade for end of contract
      return await scheduleDowngradeAtContractEnd(subscription, newLowerPriceId, contractEndDate);
    } else {
      // Contract ended, allow immediate downgrade
      return await immediateDowngrade(subscription, newLowerPriceId);
    }
  } catch (error) {
    console.error('Error requesting downgrade:', error);
    throw error;
  }
}

async function scheduleDowngradeAtContractEnd(subscription, newLowerPriceId, contractEndDate) {
  // Step 1: Create or retrieve subscription schedule
  let schedule;
  if (subscription.schedule) {
    schedule = await stripe.subscriptionSchedules.retrieve(subscription.schedule);
  } else {
    schedule = await stripe.subscriptionSchedules.create({
      from_subscription: subscription.id,
    });
  }

  // Step 2: Get current phase
  const currentPhase = schedule.phases[0];

  // Step 3: Update schedule to add downgrade phase
  const updatedSchedule = await stripe.subscriptionSchedules.update(schedule.id, {
    phases: [
      currentPhase, // Keep current phase until contract end
      {
        items: [
          {
            price: newLowerPriceId,
            quantity: 1,
          },
        ],
        iterations: 12, // Another year at lower price
        proration_behavior: 'none',
      },
    ],
    metadata: {
      scheduled_downgrade: 'true',
      downgrade_date: contractEndDate,
    },
  });

  return {
    status: 'scheduled',
    effectiveDate: contractEndDate,
    schedule: updatedSchedule,
  };
}

async function immediateDowngrade(subscription, newLowerPriceId) {
  const updatedSubscription = await stripe.subscriptions.update(subscription.id, {
    items: [
      {
        id: subscription.items.data[0].id,
        price: newLowerPriceId,
      },
    ],
    proration_behavior: 'create_prorations', // Give credit for unused time
  });

  return {
    status: 'immediate',
    subscription: updatedSubscription,
  };
}
```

### 5. Check Contract Status

Helper function to check if a customer is still in their contract period:

```javascript
async function getContractStatus(subscriptionId) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  
  const contractStart = subscription.metadata?.contract_start;
  const contractEnd = subscription.metadata?.contract_end;
  
  if (!contractStart || !contractEnd) {
    return { inContract: false, message: 'No contract found' };
  }

  const now = new Date();
  const endDate = new Date(contractEnd);
  const daysRemaining = Math.ceil((endDate - now) / (1000 * 60 * 60 * 24));

  return {
    inContract: endDate > now,
    contractStart: contractStart,
    contractEnd: contractEnd,
    daysRemaining: daysRemaining > 0 ? daysRemaining : 0,
    monthsRemaining: Math.ceil(daysRemaining / 30),
  };
}
```

### 6. Prevent Early Cancellation (Optional)

If you want to prevent cancellation during the contract:

```javascript
async function cancelSubscription(subscriptionId, immediate = false) {
  const subscription = await stripe.subscriptions.retrieve(subscriptionId);
  const contractStatus = await getContractStatus(subscriptionId);

  if (contractStatus.inContract && immediate) {
    // Don't allow immediate cancellation during contract
    // Instead, schedule for end of contract
    return await stripe.subscriptions.update(subscriptionId, {
      cancel_at_period_end: true,
      metadata: {
        cancellation_scheduled: 'true',
        cancellation_reason: 'customer_request',
      },
    });
  }

  // After contract ends, allow normal cancellation
  return await stripe.subscriptions.cancel(subscriptionId);
}
```

## Part 2: Credit Top-Up System

### Overview of Credit Top-Ups

Customers can purchase additional credits on top of their subscription at any time. These are one-time purchases that charge immediately.

**Key Differences from Subscriptions:**
- **Timing**: Charged immediately (not on next monthly bill)
- **Type**: One-time payment (not recurring)
- **Purpose**: Buy extra credits beyond subscription allocation

### Step 7: Create Credit Package Products in Stripe

Create one-time products for different credit packages:

**In Stripe Dashboard:**

1. Go to **Products** → **Add Product**
2. Create products like:
   - **100 Credits** - $10 (one-time)
   - **500 Credits** - $40 (one-time, 20% discount)
   - **1000 Credits** - $70 (one-time, 30% discount)
   - **5000 Credits** - $300 (one-time, 40% discount)

3. For each product:
   - Set pricing model: **One-time**
   - Set the price
   - Note the `price_id` (e.g., `price_100credits`)

**Example Configuration:**

```javascript
// Store these in your config or environment
const CREDIT_PACKAGES = {
  small: { 
    credits: 100, 
    priceId: 'price_100credits', 
    price: 10,
    name: '100 Credits' 
  },
  medium: { 
    credits: 500, 
    priceId: 'price_500credits', 
    price: 40,
    name: '500 Credits',
    savings: '20% off'
  },
  large: { 
    credits: 1000, 
    priceId: 'price_1000credits', 
    price: 70,
    name: '1,000 Credits',
    savings: '30% off'
  },
  xlarge: { 
    credits: 5000, 
    priceId: 'price_5000credits', 
    price: 300,
    name: '5,000 Credits',
    savings: '40% off'
  },
};
```

### Step 8: Implement Credit Purchase Function

```javascript
/**
 * Purchase credits for a customer (one-time immediate charge)
 * @param {string} customerId - Stripe customer ID
 * @param {string} priceId - Stripe price ID for the credit package
 * @param {number} creditsAmount - Number of credits being purchased
 * @returns {object} Payment result with invoice and credit details
 */
async function purchaseCredits(customerId, priceId, creditsAmount) {
  try {
    // Step 1: Create an invoice item for the credit purchase
    const invoiceItem = await stripe.invoiceItems.create({
      customer: customerId,
      price: priceId,
      description: `Credit Top-Up: ${creditsAmount} credits`,
      metadata: {
        type: 'credit_topup',
        credits_amount: creditsAmount.toString(),
      },
    });

    console.log('Invoice item created:', invoiceItem.id);

    // Step 2: Create an invoice and charge immediately
    const invoice = await stripe.invoices.create({
      customer: customerId,
      auto_advance: true, // Automatically finalize and pay
      collection_method: 'charge_automatically',
      metadata: {
        type: 'credit_topup',
        credits_amount: creditsAmount.toString(),
      },
    });

    console.log('Invoice created:', invoice.id);

    // Step 3: Finalize and pay the invoice immediately
    const finalizedInvoice = await stripe.invoices.finalizeInvoice(invoice.id);
    
    // Step 4: Attempt to pay the invoice
    const paidInvoice = await stripe.invoices.pay(invoice.id);

    console.log('Invoice paid:', paidInvoice.id);

    // Step 5: Update credit balance in your database
    await addCreditsToUserBalance(
      getUserIdFromStripeCustomer(customerId),
      creditsAmount,
      paidInvoice.id,
      paidInvoice.payment_intent,
      paidInvoice.amount_paid / 100 // Convert from cents to dollars
    );

    return {
      success: true,
      invoice: paidInvoice,
      creditsAdded: creditsAmount,
      amountPaid: paidInvoice.amount_paid / 100,
      invoiceUrl: paidInvoice.hosted_invoice_url,
      invoicePdf: paidInvoice.invoice_pdf,
    };

  } catch (error) {
    console.error('Error purchasing credits:', error);
    
    // Handle payment failures
    if (error.type === 'StripeCardError') {
      return {
        success: false,
        error: 'payment_failed',
        message: 'Your card was declined. Please try a different payment method.',
      };
    }

    throw error;
  }
}
```

### Step 9: Create Credit Purchase API Endpoint

```javascript
const express = require('express');
const router = express.Router();

/**
 * POST /api/credits/purchase
 * Purchase a credit package
 */
router.post('/credits/purchase', async (req, res) => {
  try {
    const { packageSize } = req.body;
    const userId = req.user.id; // From your auth middleware

    // Validate package
    const package = CREDIT_PACKAGES[packageSize];
    if (!package) {
      return res.status(400).json({
        error: 'Invalid package size. Choose: small, medium, large, or xlarge'
      });
    }

    // Get user's Stripe customer ID
    const user = await getUserById(userId);
    if (!user.stripe_customer_id) {
      return res.status(400).json({
        error: 'No payment method on file. Please add a payment method first.'
      });
    }

    // Purchase credits
    const result = await purchaseCredits(
      user.stripe_customer_id,
      package.priceId,
      package.credits
    );

    if (!result.success) {
      return res.status(400).json(result);
    }

    // Get updated balance
    const balance = await getCreditBalance(userId);

    return res.json({
      success: true,
      message: `Successfully purchased ${package.credits} credits`,
      credits_purchased: package.credits,
      amount_paid: result.amountPaid,
      new_balance: balance.available_credits,
      invoice_url: result.invoiceUrl,
      invoice_pdf: result.invoicePdf,
    });

  } catch (error) {
    console.error('Credit purchase error:', error);
    return res.status(500).json({
      error: 'Failed to process credit purchase',
      message: error.message
    });
  }
});

/**
 * GET /api/credits/balance
 * Get user's current credit balance
 */
router.get('/credits/balance', async (req, res) => {
  try {
    const userId = req.user.id;
    const balance = await getCreditBalance(userId);

    return res.json({
      total_credits: balance.total_credits,
      used_credits: balance.used_credits,
      available_credits: balance.available_credits,
    });

  } catch (error) {
    console.error('Error fetching balance:', error);
    return res.status(500).json({
      error: 'Failed to fetch credit balance'
    });
  }
});

/**
 * GET /api/credits/packages
 * Get available credit packages
 */
router.get('/credits/packages', (req, res) => {
  const packages = Object.entries(CREDIT_PACKAGES).map(([key, pkg]) => ({
    id: key,
    name: pkg.name,
    credits: pkg.credits,
    price: pkg.price,
    price_per_credit: (pkg.price / pkg.credits).toFixed(3),
    savings: pkg.savings || null,
  }));

  return res.json({ packages });
});

/**
 * GET /api/credits/history
 * Get credit transaction history
 */
router.get('/credits/history', async (req, res) => {
  try {
    const userId = req.user.id;
    const history = await getCreditHistory(userId);

    return res.json({ transactions: history });

  } catch (error) {
    console.error('Error fetching history:', error);
    return res.status(500).json({
      error: 'Failed to fetch credit history'
    });
  }
});

module.exports = router;
```

## Database Schema Recommendations

Store this information in your database:

```sql
-- Subscriptions table
CREATE TABLE subscriptions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  stripe_subscription_id VARCHAR(255) NOT NULL,
  stripe_schedule_id VARCHAR(255),
  plan_name VARCHAR(100),
  status VARCHAR(50),
  contract_start_date TIMESTAMP,
  contract_end_date TIMESTAMP,
  monthly_amount DECIMAL(10,2),
  created_at TIMESTAMP DEFAULT NOW(),
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Subscription changes table
CREATE TABLE subscription_changes (
  id SERIAL PRIMARY KEY,
  subscription_id INTEGER REFERENCES subscriptions(id),
  change_type VARCHAR(50), -- 'upgrade', 'downgrade', 'cancel'
  from_plan VARCHAR(100),
  to_plan VARCHAR(100),
  scheduled_date TIMESTAMP,
  status VARCHAR(50), -- 'pending', 'completed'
  created_at TIMESTAMP DEFAULT NOW()
);

-- Credit balances table
CREATE TABLE credit_balances (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL UNIQUE,
  total_credits INTEGER DEFAULT 0,
  used_credits INTEGER DEFAULT 0,
  available_credits INTEGER GENERATED ALWAYS AS (total_credits - used_credits) STORED,
  updated_at TIMESTAMP DEFAULT NOW()
);

-- Credit transactions table
CREATE TABLE credit_transactions (
  id SERIAL PRIMARY KEY,
  user_id INTEGER NOT NULL,
  transaction_type VARCHAR(50), -- 'purchase', 'usage', 'subscription_grant', 'adjustment'
  credits_amount INTEGER NOT NULL,
  price_paid DECIMAL(10,2),
  stripe_invoice_id VARCHAR(255),
  stripe_payment_intent_id VARCHAR(255),
  description TEXT,
  created_at TIMESTAMP DEFAULT NOW()
);

CREATE INDEX idx_credit_transactions_user ON credit_transactions(user_id);
CREATE INDEX idx_credit_transactions_type ON credit_transactions(transaction_type);
CREATE INDEX idx_subscriptions_user ON subscriptions(user_id);
CREATE INDEX idx_subscriptions_stripe ON subscriptions(stripe_subscription_id);

```

## Helper Functions

### Credit Management Functions

```javascript
/**
 * Add credits to user's balance in database
 */
async function addCreditsToUserBalance(userId, creditsAmount, invoiceId, paymentIntentId, pricePaid) {
  // Update credit balance
  await db.query(`
    INSERT INTO credit_balances (user_id, total_credits)
    VALUES ($1, $2)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      total_credits = credit_balances.total_credits + $2,
      updated_at = NOW()
  `, [userId, creditsAmount]);

  // Record transaction
  await db.query(`
    INSERT INTO credit_transactions (
      user_id, 
      transaction_type, 
      credits_amount, 
      price_paid,
      stripe_invoice_id,
      stripe_payment_intent_id,
      description
    )
    VALUES ($1, 'purchase', $2, $3, $4, $5, $6)
  `, [
    userId,
    creditsAmount,
    pricePaid,
    invoiceId,
    paymentIntentId,
    `Purchased ${creditsAmount} credits`
  ]);

  console.log(`Added ${creditsAmount} credits to user ${userId}`);
}

/**
 * Get credit balance for a user
 */
async function getCreditBalance(userId) {
  const result = await db.query(`
    SELECT total_credits, used_credits, available_credits
    FROM credit_balances
    WHERE user_id = $1
  `, [userId]);

  if (result.rows.length === 0) {
    return { total_credits: 0, used_credits: 0, available_credits: 0 };
  }

  return result.rows[0];
}

/**
 * Use credits (deduct from balance)
 */
async function useCredits(userId, creditsAmount, description = 'Service usage') {
  // Check if user has enough credits
  const balance = await getCreditBalance(userId);
  if (balance.available_credits < creditsAmount) {
    throw new Error('Insufficient credits');
  }

  // Deduct credits using a transaction for atomicity
  await db.query('BEGIN');
  
  try {
    // Deduct credits
    await db.query(`
      UPDATE credit_balances
      SET used_credits = used_credits + $1,
          updated_at = NOW()
      WHERE user_id = $2
    `, [creditsAmount, userId]);

    // Record transaction
    await db.query(`
      INSERT INTO credit_transactions (
        user_id, 
        transaction_type, 
        credits_amount, 
        description
      )
      VALUES ($1, 'usage', $2, $3)
    `, [userId, -creditsAmount, description]);

    await db.query('COMMIT');
    console.log(`Deducted ${creditsAmount} credits from user ${userId}`);
  } catch (error) {
    await db.query('ROLLBACK');
    throw error;
  }
}

/**
 * Grant subscription credits monthly
 * Call this when processing a successful subscription payment
 */
async function grantSubscriptionCredits(userId, creditsAmount, subscriptionId) {
  await db.query(`
    INSERT INTO credit_balances (user_id, total_credits)
    VALUES ($1, $2)
    ON CONFLICT (user_id) 
    DO UPDATE SET 
      total_credits = credit_balances.total_credits + $2,
      updated_at = NOW()
  `, [userId, creditsAmount]);

  await db.query(`
    INSERT INTO credit_transactions (
      user_id, 
      transaction_type, 
      credits_amount, 
      description
    )
    VALUES ($1, 'subscription_grant', $2, $3)
  `, [userId, creditsAmount, `Monthly subscription credits from ${subscriptionId}`]);

  console.log(`Granted ${creditsAmount} subscription credits to user ${userId}`);
}

/**
 * Get credit transaction history
 */
async function getCreditHistory(userId, limit = 50) {
  const result = await db.query(`
    SELECT 
      transaction_type,
      credits_amount,
      price_paid,
      description,
      created_at
    FROM credit_transactions
    WHERE user_id = $1
    ORDER BY created_at DESC
    LIMIT $2
  `, [userId, limit]);

  return result.rows;
}

/**
 * Example: Process a service request that uses credits
 */
async function processServiceRequest(userId, featureType) {
  const CREDIT_COSTS = {
    basic_feature: 1,
    premium_feature: 5,
    advanced_feature: 10,
  };

  const costInCredits = CREDIT_COSTS[featureType];

  try {
    // Check and deduct credits
    await useCredits(userId, costInCredits, `Used ${featureType}`);
    
    // Process the service
    const result = await performYourService(featureType);
    
    return {
      success: true,
      result: result,
      credits_used: costInCredits,
    };

  } catch (error) {
    if (error.message === 'Insufficient credits') {
      return {
        success: false,
        error: 'insufficient_credits',
        message: 'You need more credits. Please top up your account.',
      };
    }
    throw error;
  }
}
```

## Webhook Handlers

Set up these webhooks to keep your system in sync:

```javascript
async function handleStripeWebhook(event) {
  switch (event.type) {
    // Subscription schedule events
    case 'subscription_schedule.created':
      console.log('Schedule created:', event.data.object.id);
      // Store schedule ID in your database
      break;

    case 'subscription_schedule.updated':
      console.log('Schedule updated:', event.data.object.id);
      // Update schedule info in your database
      break;

    // Subscription events
    case 'customer.subscription.updated':
      const subscription = event.data.object;
      console.log('Subscription updated:', subscription.id);
      // Update subscription status in your database
      break;

    case 'customer.subscription.created':
      const newSubscription = event.data.object;
      console.log('Subscription created:', newSubscription.id);
      // Store new subscription in your database
      break;

    // Invoice events (handles both subscription AND credit purchases)
    case 'invoice.payment_succeeded':
      const successfulInvoice = event.data.object;
      console.log('Payment succeeded:', successfulInvoice.id);
      
      // Check if this is a credit top-up
      if (successfulInvoice.metadata?.type === 'credit_topup') {
        const creditsAmount = parseInt(successfulInvoice.metadata.credits_amount);
        const userId = await getUserIdFromStripeCustomer(successfulInvoice.customer);
        
        // Verify credits were added (idempotent operation)
        const balance = await getCreditBalance(userId);
        console.log(`Credit purchase processed. User ${userId} balance: ${balance.available_credits}`);
        
        // Send confirmation email
        await sendCreditPurchaseConfirmation(userId, creditsAmount);
      } else {
        // Regular subscription payment
        // Grant monthly subscription credits if your plan includes them
        const userId = await getUserIdFromStripeCustomer(successfulInvoice.customer);
        // await grantSubscriptionCredits(userId, MONTHLY_CREDIT_ALLOCATION, successfulInvoice.subscription);
      }
      break;

    case 'invoice.payment_failed':
      const failedInvoice = event.data.object;
      console.log('Payment failed:', failedInvoice.id);
      
      // Check if this was a credit top-up
      if (failedInvoice.metadata?.type === 'credit_topup') {
        const creditsAmount = failedInvoice.metadata.credits_amount;
        console.log(`Credit purchase failed for ${creditsAmount} credits`);
        
        // Send payment failure notification
        await sendPaymentFailedEmail(
          failedInvoice.customer,
          creditsAmount,
          failedInvoice.amount_due / 100
        );
      } else {
        // Subscription payment failed - handle according to your policy
        const userId = await getUserIdFromStripeCustomer(failedInvoice.customer);
        await handleSubscriptionPaymentFailure(userId, failedInvoice);
      }
      break;

    case 'invoice.finalized':
      const finalizedInvoice = event.data.object;
      console.log('Invoice finalized:', finalizedInvoice.id);
      // Send invoice to customer if needed
      break;
  }
}
```
```

## User Interface Considerations

### Display Current Plan Status

Show users:
- Current plan name
- Monthly billing amount
- Contract end date
- "X months remaining in contract"
- Whether they have a scheduled downgrade
- **Credit balance and usage**

```javascript
// Example UI data structure
const accountInfo = {
  subscription: {
    currentPlan: 'Premium',
    monthlyAmount: '$99',
    billingDate: '15th of each month',
    contractEndDate: '2026-10-26',
    monthsRemaining: 8,
    scheduledChanges: [
      {
        type: 'downgrade',
        toPlan: 'Basic',
        effectiveDate: '2026-10-26',
      },
    ],
  },
  credits: {
    available: 1250,
    total: 2000,
    used: 750,
    lastPurchase: '2025-10-15',
    monthlyAllocation: 500, // from subscription
  }
};
```

### Frontend: Credit Balance Component

```javascript
// React component for displaying credit balance
function CreditBalance() {
  const [balance, setBalance] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    fetchBalance();
  }, []);

  async function fetchBalance() {
    try {
      const response = await fetch('/api/credits/balance');
      const data = await response.json();
      setBalance(data);
    } catch (error) {
      console.error('Error fetching balance:', error);
    } finally {
      setLoading(false);
    }
  }

  if (loading) return <div>Loading...</div>;

  return (
    <div className="credit-balance-card">
      <h3>Your Credit Balance</h3>
      <div className="balance-display">
        <div className="main-balance">
          <span className="balance-number">{balance.available_credits}</span>
          <span className="balance-label">Available Credits</span>
        </div>
        <div className="balance-details">
          <p>Total Purchased: {balance.total_credits}</p>
          <p>Used: {balance.used_credits}</p>
        </div>
      </div>
      <button 
        className="btn-primary"
        onClick={() => window.location.href = '/credits/purchase'}
      >
        Buy More Credits
      </button>
    </div>
  );
}
```

### Frontend: Credit Packages Component

```javascript
// React component for purchasing credit packages
function CreditPackages() {
  const [packages, setPackages] = useState([]);
  const [loading, setLoading] = useState(false);
  const [purchasing, setPurchasing] = useState(null);

  useEffect(() => {
    fetchPackages();
  }, []);

  async function fetchPackages() {
    const response = await fetch('/api/credits/packages');
    const data = await response.json();
    setPackages(data.packages);
  }

  async function purchasePackage(packageId) {
    setPurchasing(packageId);
    try {
      const response = await fetch('/api/credits/purchase', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ packageSize: packageId }),
      });

      const result = await response.json();

      if (result.success) {
        alert(`Successfully purchased ${result.credits_purchased} credits!`);
        // Refresh the page or update state
        window.location.reload();
      } else {
        alert(`Error: ${result.message}`);
      }
    } catch (error) {
      alert('Failed to purchase credits. Please try again.');
    } finally {
      setPurchasing(null);
    }
  }

  return (
    <div className="credit-packages">
      <h2>Buy More Credits</h2>
      <p className="subtitle">Choose a package that fits your needs</p>
      
      <div className="packages-grid">
        {packages.map(pkg => (
          <div key={pkg.id} className="package-card">
            {pkg.savings && (
              <span className="savings-badge">{pkg.savings}</span>
            )}
            <h3>{pkg.name}</h3>
            <div className="package-price">
              <span className="price">${pkg.price}</span>
              <span className="per-credit">${pkg.price_per_credit}/credit</span>
            </div>
            <ul className="package-features">
              <li>{pkg.credits.toLocaleString()} credits</li>
              <li>Instant delivery</li>
              <li>Never expires</li>
            </ul>
            <button 
              className="btn-purchase"
              onClick={() => purchasePackage(pkg.id)}
              disabled={purchasing === pkg.id}
            >
              {purchasing === pkg.id ? 'Processing...' : 'Purchase Now'}
            </button>
          </div>
        ))}
      </div>
    </div>
  );
}
```

### Frontend: Combined Dashboard

```javascript
// Complete user dashboard showing subscription + credits
function AccountDashboard() {
  return (
    <div className="dashboard">
      <div className="dashboard-header">
        <h1>My Account</h1>
      </div>
      
      <div className="dashboard-grid">
        {/* Subscription Info */}
        <div className="card subscription-card">
          <h2>Subscription</h2>
          <SubscriptionStatus />
        </div>

        {/* Credit Balance */}
        <div className="card credits-card">
          <h2>Credits</h2>
          <CreditBalance />
        </div>

        {/* Recent Activity */}
        <div className="card activity-card">
          <h2>Recent Activity</h2>
          <RecentTransactions />
        </div>
      </div>
    </div>
  );
}
```
```

### Downgrade Request Flow

1. User clicks "Downgrade Plan"
2. Check contract status
3. If in contract:
   - Show message: "Your downgrade will take effect on [contract_end_date]"
   - Explain they must complete current contract
4. If contract ended:
   - Allow immediate downgrade with proration credit

## Testing Checklist

Test these scenarios in Stripe's test mode:

### Subscription Testing
- [ ] Create new yearly contract subscription
- [ ] Verify 12 monthly invoices are generated
- [ ] Test immediate upgrade (verify proration)
- [ ] Test downgrade request during contract (should schedule for later)
- [ ] Test downgrade request after contract (should apply immediately)
- [ ] Test cancellation during contract
- [ ] Test subscription payment success
- [ ] Test subscription payment failure
- [ ] Verify webhook events fire correctly

### Credit Top-Up Testing
- [ ] Purchase smallest credit package (100 credits)
- [ ] Purchase largest credit package (5000 credits)
- [ ] Test successful credit purchase
- [ ] Test with declined card (use test card: 4000 0000 0000 0002)
- [ ] Test with insufficient funds (use test card: 4000 0000 0000 9995)
- [ ] Verify credits added to database after successful purchase
- [ ] Verify credits NOT added after failed payment
- [ ] Check invoice is generated correctly for credit purchase
- [ ] Check receipt email is sent
- [ ] Test credit usage/deduction
- [ ] Test insufficient credits error
- [ ] Verify transaction history displays correctly

### Integration Testing
- [ ] Purchase credits while having active subscription
- [ ] Verify monthly subscription payment doesn't affect credit balance
- [ ] Test using credits from both subscription and top-ups
- [ ] Downgrade subscription and verify credit allocations change
- [ ] Test with Stripe's test clock for time-based scenarios
- [ ] Verify both subscription invoices and credit invoices appear separately

### Stripe Test Cards

```javascript
// Use these test cards in Stripe test mode
const TEST_CARDS = {
  success: '4242 4242 4242 4242',
  declined: '4000 0000 0000 0002',
  insufficientFunds: '4000 0000 0000 9995',
  expiredCard: '4000 0000 0000 0069',
  processingError: '4000 0000 0000 0119',
};

## Common Gotchas

### Subscription-Related

1. **Schedule IDs vs Subscription IDs**: When a subscription has a schedule, you need to update the schedule, not the subscription directly

2. **Metadata persistence**: Store important dates in metadata for easy access

3. **Phase transitions**: When updating a schedule, you must pass ALL phases (current + future), not just the changes

4. **Collection method**: If you see errors about `collection_method` when updating schedules, make sure to set it explicitly

5. **Proration behavior**: Different for upgrades (immediate) vs downgrades (scheduled)

### Credit-Related

6. **Race Conditions**: Use database transactions when updating credit balances to prevent race conditions
   ```javascript
   // BAD: Not atomic
   const balance = await getCreditBalance(userId);
   if (balance >= cost) {
     await deductCredits(userId, cost);
   }
   
   // GOOD: Atomic transaction
   await db.query('BEGIN');
   await deductCredits(userId, cost); // Will fail if insufficient
   await db.query('COMMIT');
   ```

7. **Duplicate Charges**: Use idempotency keys for credit purchases to prevent double-charging
   ```javascript
   const invoiceItem = await stripe.invoiceItems.create({
     customer: customerId,
     price: priceId,
   }, {
     idempotencyKey: `credit_purchase_${userId}_${timestamp}`
   });
   ```

8. **Webhook Timing**: Credits might be added via webhook before API response returns. Always fetch fresh balance after purchase.

9. **Negative Balances**: Add database constraints to prevent negative credits
   ```sql
   ALTER TABLE credit_balances 
   ADD CONSTRAINT check_non_negative 
   CHECK (available_credits >= 0);
   ```

10. **Invoice vs Charge**: For credit top-ups, always use Invoice Items + Invoices (not direct Charges) for better record-keeping

11. **Failed Payment Cleanup**: Make sure failed credit purchases don't add credits to user balance

12. **Refunds**: When refunding a credit purchase, remember to deduct credits from the user's balance
    ```javascript
    async function refundCreditPurchase(invoiceId, userId, creditsAmount) {
      // Refund in Stripe
      await stripe.refunds.create({ invoice: invoiceId });
      
      // Deduct credits from user
      await db.query(`
        UPDATE credit_balances
        SET total_credits = total_credits - $1
        WHERE user_id = $2
      `, [creditsAmount, userId]);
    }
    ```

## How Subscriptions and Credits Work Together

### Architecture

```
┌─────────────────────────────────────┐
│     User Account                    │
├─────────────────────────────────────┤
│                                     │
│  Subscription (Recurring)           │
│  ├─ $99/month                       │
│  ├─ 12-month contract               │
│  └─ Optional: 500 credits/month     │
│                                     │
│  +                                  │
│                                     │
│  Credit Top-Ups (One-time)          │
│  ├─ Purchase anytime                │
│  ├─ Different packages              │
│  └─ Immediate payment               │
│                                     │
│  =                                  │
│                                     │
│  Total Credit Balance               │
│  └─ All credits combined            │
│                                     │
└─────────────────────────────────────┘
```

### Key Principles

1. **Independent Billing**
   - Subscription: Recurring monthly charges
   - Credits: One-time immediate charges
   - They appear on separate invoices

2. **Credit Tracking**
   - All credits (subscription + purchased) go into one balance
   - Your database tracks the total available credits
   - Credits don't expire (unless you implement expiration)

3. **Usage Priority** (Optional - you decide)
   - Option A: Use oldest credits first (FIFO)
   - Option B: Use subscription credits first, then purchased
   - Option C: Treat all credits equally

4. **Subscription Changes**
   - Upgrading subscription: May grant more monthly credits
   - Downgrading subscription: May reduce monthly credits (at contract end)
   - Purchased credits are unaffected by subscription changes

### Example Scenarios

#### Scenario 1: New Customer
```
Day 1: Subscribe to Premium ($99/month)
  → Grants 500 credits immediately
  → Credit balance: 500

Day 5: Purchase 1000 credit package ($70)
  → Credits added immediately
  → Credit balance: 1,500

Day 15: Use 200 credits for services
  → Credit balance: 1,300

Month 2: Subscription renews
  → Grants another 500 credits
  → Credit balance: 1,800
```

#### Scenario 2: Heavy User
```
Month 1: 
  - Subscription grants: 500 credits
  - Purchase: 1000 credits
  - Total: 1,500 credits
  - Used: 1,200 credits
  - Remaining: 300 credits

Month 2:
  - Previous balance: 300 credits
  - Subscription grants: 500 credits
  - Total: 800 credits
  - Used: 600 credits
  - Remaining: 200 credits
```

#### Scenario 3: Downgrade During Contract
```
Month 1-8: Premium plan ($99/month, 500 credits/month)
  - Accumulated 4,000 credits total
  - Used 3,000 credits
  - Balance: 1,000 credits

Month 9: Request downgrade to Basic
  - Downgrade scheduled for Month 13 (end of contract)
  - Continue receiving 500 credits/month until then
  - Purchased credits remain unaffected

Month 13: Downgrade takes effect
  - Now receives 100 credits/month (Basic plan)
  - Previous balance still available: 1,000+ credits
  - Can still purchase credit top-ups
```

### Database Query Examples

```javascript
// Get complete credit breakdown
async function getCreditBreakdown(userId) {
  const result = await db.query(`
    SELECT 
      cb.total_credits,
      cb.used_credits,
      cb.available_credits,
      COUNT(CASE WHEN ct.transaction_type = 'purchase' THEN 1 END) as purchases_count,
      COUNT(CASE WHEN ct.transaction_type = 'subscription_grant' THEN 1 END) as monthly_grants,
      SUM(CASE WHEN ct.transaction_type = 'purchase' THEN ct.credits_amount ELSE 0 END) as total_purchased,
      SUM(CASE WHEN ct.transaction_type = 'subscription_grant' THEN ct.credits_amount ELSE 0 END) as total_from_subscription
    FROM credit_balances cb
    LEFT JOIN credit_transactions ct ON ct.user_id = cb.user_id
    WHERE cb.user_id = $1
    GROUP BY cb.user_id, cb.total_credits, cb.used_credits, cb.available_credits
  `, [userId]);

  return result.rows[0];
}

// Example response:
// {
//   total_credits: 2000,
//   used_credits: 750,
//   available_credits: 1250,
//   purchases_count: 3,
//   monthly_grants: 4,
//   total_purchased: 1500,
//   total_from_subscription: 500
// }
```

## Environment Variables

Add these to your `.env` file:

```bash
# Stripe API Keys
STRIPE_SECRET_KEY=sk_test_xxxxx
STRIPE_PUBLISHABLE_KEY=pk_test_xxxxx
STRIPE_WEBHOOK_SECRET=whsec_xxxxx

# Subscription Plan Price IDs
PRICE_PREMIUM_MONTHLY=price_xxxxx
PRICE_BASIC_MONTHLY=price_xxxxx

# Credit Package Price IDs
PRICE_100_CREDITS=price_100credits
PRICE_500_CREDITS=price_500credits
PRICE_1000_CREDITS=price_1000credits
PRICE_5000_CREDITS=price_5000credits

# Optional: Credit allocations per plan
PREMIUM_MONTHLY_CREDITS=500
BASIC_MONTHLY_CREDITS=100
```

## Next Steps

1. Set up Stripe products and prices in the Dashboard
2. Implement the subscription creation flow
3. Add upgrade/downgrade endpoints to your API
4. Create webhook handlers
5. Update your frontend to display contract status
6. Test thoroughly with Stripe test mode
7. Set up monitoring for failed payments

## Resources

- [Stripe Subscription Schedules Docs](https://docs.stripe.com/billing/subscriptions/subscription-schedules)
- [Stripe API Reference](https://docs.stripe.com/api)
- [Testing with Stripe](https://docs.stripe.com/testing)

## Questions?

If you run into issues:
1. Check Stripe Dashboard logs for API errors
2. Review webhook event history
3. Use Stripe's test clock to simulate time-based scenarios
4. Ask for help if needed!
