#!/usr/bin/env node

// Load environment variables from .env.local
require('dotenv').config({ path: '.env' });

const fs = require('fs');
const path = require('path');
const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

function toCents(amount) { return Math.round(Number(amount) * 100); }

function readPricingConfigTs() {
  const filePath = path.join(__dirname, '..', 'src', 'config', 'pricing.ts').replace(/scripts\/..\//, '');
  const altPath = path.resolve(process.cwd(), 'src/config/pricing.ts');
  const target = fs.existsSync(filePath) ? filePath : altPath;
  const content = fs.readFileSync(target, 'utf8');
  const ids = {};
  const idMatch = content.match(/const STRIPE_PRICE_IDS = \{[\s\S]*?\}/);
  if (idMatch) {
    const entries = idMatch[0].match(/([A-Z0-9_]+):\s*'([^']*)'/g) || [];
    entries.forEach((e) => {
      const [, key, val] = e.match(/([A-Z0-9_]+):\s*'([^']*)'/) || [];
      if (key) ids[key] = val;
    });
  }
  const num = (re) => {
    const m = content.match(re);
    return m ? Number(m[1]) : undefined;
  };
  return {
    ids,
    prices: {
      tryOnce: { price: num(/tryOnce:\s*\{[\s\S]*?price:\s*([0-9.]+)/), credits: num(/tryOnce:[\s\S]*?credits:\s*([0-9]+)/) },
      tryOnceTopUp: { price: num(/tryOnce:[\s\S]*?topUp:\s*\{[\s\S]*?price:\s*([0-9.]+)/), credits: num(/tryOnce:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
      individualMonthly: { price: num(/individual:[\s\S]*?monthly:[\s\S]*?price:\s*([0-9.]+)/), credits: num(/individual:[\s\S]*?includedCredits:\s*([0-9]+)/) },
      individualAnnual: { price: num(/individual:[\s\S]*?annual:[\s\S]*?price:\s*([0-9.]+)/), credits: num(/individual:[\s\S]*?includedCredits:\s*([0-9]+)/) },
      individualTopUp: { price: num(/individual:[\s\S]*?topUp:[\s\S]*?price:\s*([0-9.]+)/), credits: num(/individual:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
      proMonthly: { price: num(/pro:[\s\S]*?monthly:[\s\S]*?price:\s*([0-9.]+)/), credits: num(/pro:[\s\S]*?includedCredits:\s*([0-9]+)/) },
      proAnnual: { price: num(/pro:[\s\S]*?annual:[\s\S]*?price:\s*([0-9.]+)/), credits: num(/pro:[\s\S]*?includedCredits:\s*([0-9]+)/) },
      proTopUp: { price: num(/pro:[\s\S]*?topUp:[\s\S]*?price:\s*([0-9.]+)/), credits: num(/pro:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
    }
  }
}

async function createProducts() {
  console.log('🚀 Creating Stripe products and prices...');

  try {
    // Read pricing from src/config/pricing.ts to avoid drift
    const read = readPricingConfigTs()
    // 1. Try Once Product
    console.log('📦 Creating Try Once product...');
    const tryOnceProduct = await stripe.products.create({
      name: 'Try Once - 10 Credits',
      description: 'One-time purchase of 10 credits for photo generation',
      metadata: {
        type: 'try_once',
        credits: '10'
      }
    });

    const tryOncePrice = await stripe.prices.create({
      product: tryOnceProduct.id,
      unit_amount: toCents(read.prices.tryOnce?.price ?? 5.00),
      currency: 'usd',
      metadata: {
        type: 'try_once',
        credits: '10'
      }
    });

    console.log(`✅ Try Once - Price ID: ${tryOncePrice.id}`);

    // 2. Individual/Starter Products
    console.log('📦 Creating Individual/Starter products...');
    const individualProduct = await stripe.products.create({
      name: 'Individual Plan',
      description: 'Personal photo generation plan',
      metadata: {
        type: 'individual',
        credits: '60'
      }
    });

    // Monthly
    const individualMonthlyPrice = await stripe.prices.create({
      product: individualProduct.id,
      unit_amount: toCents(read.prices.individualMonthly?.price ?? 24.00),
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: {
        type: 'individual',
        period: 'monthly',
        credits: '60'
      }
    });

    // Annual-contract monthly (discounted per-month for yearly contract)
    const individualAnnualMonthly = (read.prices.individualAnnual?.price ?? 228.00) / 12
    const individualAnnualMonthlyPrice = await stripe.prices.create({
      product: individualProduct.id,
      unit_amount: toCents(individualAnnualMonthly),
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: {
        type: 'individual',
        period: 'annual_monthly',
        credits: '60'
      }
    });

    console.log(`✅ Individual Monthly - Price ID: ${individualMonthlyPrice.id}`);
    console.log(`✅ Individual Annual (monthly charge) - Price ID: ${individualAnnualMonthlyPrice.id}`);

    // 3. Pro/Business Products
    console.log('📦 Creating Pro/Business products...');
    const proProduct = await stripe.products.create({
      name: 'Pro Plan',
      description: 'Business photo generation plan',
      metadata: {
        type: 'pro',
        credits: '200'
      }
    });

    // Monthly
    const proMonthlyPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: toCents(read.prices.proMonthly?.price ?? 59.00),
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: {
        type: 'pro',
        period: 'monthly',
        credits: '200'
      }
    });

    // Annual-contract monthly (discounted per-month for yearly contract)
    const proAnnualMonthly = (read.prices.proAnnual?.price ?? 588.00) / 12
    const proAnnualMonthlyPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: toCents(proAnnualMonthly),
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: {
        type: 'pro',
        period: 'annual_monthly',
        credits: '200'
      }
    });

    console.log(`✅ Pro Monthly - Price ID: ${proMonthlyPrice.id}`);
    console.log(`✅ Pro Annual (monthly charge) - Price ID: ${proAnnualMonthlyPrice.id}`);

    // 4. Top-up products
    console.log('📦 Creating Top-Up products...')
    const individualTopUpProduct = await stripe.products.create({
      name: 'Individual Top-Up',
      description: 'One-time purchase of credits (individual)',
      metadata: { type: 'top_up', tier: 'individual' }
    })
    const individualTopUpPrice = await stripe.prices.create({
      product: individualTopUpProduct.id,
      unit_amount: toCents(read.prices.individualTopUp?.price ?? 9.99),
      currency: 'usd',
      metadata: { type: 'top_up', tier: 'individual', credits: '30' }
    })

    const proTopUpProduct = await stripe.products.create({
      name: 'Pro Top-Up',
      description: 'One-time purchase of credits (pro)',
      metadata: { type: 'top_up', tier: 'pro' }
    })
    const proTopUpPrice = await stripe.prices.create({
      product: proTopUpProduct.id,
      unit_amount: toCents(read.prices.proTopUp?.price ?? 24.99),
      currency: 'usd',
      metadata: { type: 'top_up', tier: 'pro', credits: '100' }
    })

    const tryOnceTopUpProduct = await stripe.products.create({
      name: 'Try Once Top-Up',
      description: 'One-time purchase of credits for Try Once users',
      metadata: { type: 'top_up', tier: 'try_once' }
    })
    const tryOnceTopUpPrice = await stripe.prices.create({
      product: tryOnceTopUpProduct.id,
      unit_amount: toCents(read.prices.tryOnceTopUp?.price ?? 8.90),
      currency: 'usd',
      metadata: { type: 'top_up', tier: 'try_once', credits: '20' }
    })

    // Output config snippet for PRICE_IDS in src/config/pricing.ts
    console.log('\n📋 Add these IDs to PRICE_IDS in src/config/pricing.ts:');
    console.log('TRY_ONCE:', `"${tryOncePrice.id}"`);
    console.log('INDIVIDUAL_MONTHLY:', `"${individualMonthlyPrice.id}"`);
    console.log('INDIVIDUAL_ANNUAL_MONTHLY:', `"${individualAnnualMonthlyPrice.id}"`);
    console.log('PRO_MONTHLY:', `"${proMonthlyPrice.id}"`);
    console.log('PRO_ANNUAL_MONTHLY:', `"${proAnnualMonthlyPrice.id}"`);
    console.log('INDIVIDUAL_TOP_UP:', `"${individualTopUpPrice.id}"`);
    console.log('PRO_TOP_UP:', `"${proTopUpPrice.id}"`);
    console.log('TRY_ONCE_TOP_UP:', `"${tryOnceTopUpPrice.id}"`);

    console.log('\n✅ All products and prices created successfully!');

  } catch (error) {
    console.error('❌ Error creating products:', error);
    process.exit(1);
  }
}

async function checkAlignment() {
  console.log('🔎 Checking Stripe prices vs src/config/pricing.ts ...')
  const { ids, prices } = readPricingConfigTs()

  const results = []
  async function check(name, idKey, expected, recurringInterval) {
    const priceId = ids[idKey]
    if (!priceId) { results.push({ name, ok: false, reason: `Missing price ID for ${idKey}` }); return }
    const price = await stripe.prices.retrieve(priceId)
    const amountOk = price.unit_amount === toCents(expected)
    const currencyOk = (price.currency || 'usd') === 'usd'
    const intervalOk = recurringInterval ? price.recurring?.interval === recurringInterval : !price.recurring
    results.push({ name, ok: amountOk && currencyOk && intervalOk, amountOk, currencyOk, intervalOk, current: price.unit_amount, expected: toCents(expected) })
  }

  await check('Try Once', 'TRY_ONCE', prices.tryOnce.price)
  await check('Individual Monthly', 'INDIVIDUAL_MONTHLY', prices.individualMonthly.price, 'month')
  await check('Individual Annual (monthly charge)', 'INDIVIDUAL_ANNUAL_MONTHLY', (prices.individualAnnual.price / 12), 'month')
  await check('Pro Monthly', 'PRO_MONTHLY', prices.proMonthly.price, 'month')
  await check('Pro Annual (monthly charge)', 'PRO_ANNUAL_MONTHLY', (prices.proAnnual.price / 12), 'month')
  await check('Individual Top-Up', 'INDIVIDUAL_TOP_UP', prices.individualTopUp.price)
  await check('Pro Top-Up', 'PRO_TOP_UP', prices.proTopUp.price)
  await check('Try Once Top-Up', 'TRY_ONCE_TOP_UP', prices.tryOnceTopUp.price)

  let ok = true
  for (const r of results) {
    if (!r.ok) {
      ok = false
      console.log(`❌ ${r.name} mismatch`, r)
    } else {
      console.log(`✅ ${r.name} aligned`)
    }
  }
  if (!ok) process.exit(2)
  console.log('✅ All prices aligned')
}

const mode = process.argv[2] || 'create'
if (mode === 'check') {
  checkAlignment().catch((e) => { console.error(e); process.exit(1) })
} else {
  createProducts().catch((e) => { console.error(e); process.exit(1) })
}
