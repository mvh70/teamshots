#!/usr/bin/env node

// Load environment variables from .env
import dotenv from 'dotenv';
dotenv.config({ path: '.env' });

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { dirname } from 'path';
import Stripe from 'stripe';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

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
      individual: { price: num(/individual:\s*\{[\s\S]*?price:\s*([0-9.]+)/), credits: num(/individual:[\s\S]*?credits:\s*([0-9]+)/) },
      individualTopUp: { price: num(/individual:[\s\S]*?topUp:\s*\{[\s\S]*?price:\s*([0-9.]+)/), credits: num(/individual:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
      proSmall: { price: num(/proSmall:\s*\{[\s\S]*?price:\s*([0-9.]+)/), credits: num(/proSmall:[\s\S]*?credits:\s*([0-9]+)/) },
      proSmallTopUp: { price: num(/proSmall:[\s\S]*?topUp:\s*\{[\s\S]*?price:\s*([0-9.]+)/), credits: num(/proSmall:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
      proLarge: { price: num(/proLarge:\s*\{[\s\S]*?price:\s*([0-9.]+)/), credits: num(/proLarge:[\s\S]*?credits:\s*([0-9]+)/) },
      proLargeTopUp: { price: num(/proLarge:[\s\S]*?topUp:\s*\{[\s\S]*?price:\s*([0-9.]+)/), credits: num(/proLarge:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
    }
  }
}

async function createProducts() {
  console.log('🚀 Creating Stripe products and prices (one-time transactional)...');

  try {
    // Read pricing from src/config/pricing.ts to avoid drift
    const read = readPricingConfigTs()

    // 1. Try Once Product
    console.log('📦 Creating Try Once product...');
    const tryOnceProduct = await stripe.products.create({
      name: 'Try Once - 1 photo',
      description: 'One-time purchase of 1 photo for photo generation',
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

    // 2. Individual Product (one-time)
    console.log('📦 Creating Individual product...');
    const individualProduct = await stripe.products.create({
      name: 'Individual Plan - 5 photos',
      description: 'One-time purchase for personal photo generation (5 photos)',
      metadata: {
        type: 'individual',
        credits: '50'
      }
    });

    const individualPrice = await stripe.prices.create({
      product: individualProduct.id,
      unit_amount: toCents(read.prices.individual?.price ?? 19.99),
      currency: 'usd',
      metadata: {
        type: 'individual',
        credits: '50'
      }
    });

    console.log(`✅ Individual - Price ID: ${individualPrice.id}`);

    // 3. Pro Small Product (up to 5 team members - one-time)
    console.log('📦 Creating Pro Small product...');
    const proSmallProduct = await stripe.products.create({
      name: 'Pro Small Plan - 5 photos',
      description: 'One-time purchase for teams up to 5 members (5 photos)',
      metadata: {
        type: 'pro_small',
        credits: '50',
        maxTeamMembers: '5'
      }
    });

    const proSmallPrice = await stripe.prices.create({
      product: proSmallProduct.id,
      unit_amount: toCents(read.prices.proSmall?.price ?? 19.99),
      currency: 'usd',
      metadata: {
        type: 'pro_small',
        credits: '50',
        maxTeamMembers: '5'
      }
    });

    console.log(`✅ Pro Small - Price ID: ${proSmallPrice.id}`);

    // 4. Pro Large Product (more than 5 team members - one-time)
    console.log('📦 Creating Pro Large product...');
    const proLargeProduct = await stripe.products.create({
      name: 'Pro Large Plan - 20 photos',
      description: 'One-time purchase for teams with more than 5 members (20 photos)',
      metadata: {
        type: 'pro_large',
        credits: '200',
        maxTeamMembers: 'unlimited'
      }
    });

    const proLargePrice = await stripe.prices.create({
      product: proLargeProduct.id,
      unit_amount: toCents(read.prices.proLarge?.price ?? 59.99),
      currency: 'usd',
      metadata: {
        type: 'pro_large',
        credits: '200'
      }
    });

    console.log(`✅ Pro Large - Price ID: ${proLargePrice.id}`);

    // 5. Top-up products (one-time)
    console.log('📦 Creating Top-Up products...')

    const individualTopUpProduct = await stripe.products.create({
      name: 'Individual Top-Up - 5 photos',
      description: 'One-time purchase of 5 photos (individual)',
      metadata: { type: 'top_up', tier: 'individual' }
    })
    const individualTopUpPrice = await stripe.prices.create({
      product: individualTopUpProduct.id,
      unit_amount: toCents(read.prices.individualTopUp?.price ?? 19.99),
      currency: 'usd',
      metadata: { type: 'top_up', tier: 'individual', credits: '50' }
    })

    const proSmallTopUpProduct = await stripe.products.create({
      name: 'Pro Small Top-Up - 5 photos',
      description: 'One-time purchase of 50 credits (pro small)',
      metadata: { type: 'top_up', tier: 'pro_small' }
    })
    const proSmallTopUpPrice = await stripe.prices.create({
      product: proSmallTopUpProduct.id,
      unit_amount: toCents(read.prices.proSmallTopUp?.price ?? 19.99),
      currency: 'usd',
      metadata: { type: 'top_up', tier: 'pro_small', credits: '50' }
    })

    const proLargeTopUpProduct = await stripe.products.create({
      name: 'Pro Large Top-Up - 10 Photos',
      description: 'One-time purchase of 10 photos for Pro Large users',
      metadata: { type: 'top_up', tier: 'pro_large' }
    })
    const proLargeTopUpPrice = await stripe.prices.create({
      product: proLargeTopUpProduct.id,
      unit_amount: toCents(read.prices.proLargeTopUp?.price ?? 29.99),
      currency: 'usd',
      metadata: { type: 'top_up', tier: 'pro_large', credits: '100' }
    })

    const tryOnceTopUpProduct = await stripe.products.create({
      name: 'Try Once Top-Up - 5 Photos',
      description: 'One-time purchase of 5 photos for Try Once users',
      metadata: { type: 'top_up', tier: 'try_once' }
    })
    const tryOnceTopUpPrice = await stripe.prices.create({
      product: tryOnceTopUpProduct.id,
      unit_amount: toCents(read.prices.tryOnceTopUp?.price ?? 24.99),
      currency: 'usd',
      metadata: { type: 'top_up', tier: 'try_once', credits: '50' }
    })

    // Output config snippet for PRICE_IDS in src/config/pricing.ts
    console.log('\n📋 Add these IDs to PRICE_IDS in src/config/pricing.ts:');
    console.log('TRY_ONCE:', `"${tryOncePrice.id}"`);
    console.log('INDIVIDUAL:', `"${individualPrice.id}"`);
    console.log('PRO_SMALL:', `"${proSmallPrice.id}"`);
    console.log('PRO_LARGE:', `"${proLargePrice.id}"`);
    console.log('INDIVIDUAL_TOP_UP:', `"${individualTopUpPrice.id}"`);
    console.log('PRO_SMALL_TOP_UP:', `"${proSmallTopUpPrice.id}"`);
    console.log('PRO_LARGE_TOP_UP:', `"${proLargeTopUpPrice.id}"`);
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
  async function check(name, idKey, expected) {
    const priceId = ids[idKey]
    if (!priceId) { results.push({ name, ok: false, reason: `Missing price ID for ${idKey}` }); return }
    const price = await stripe.prices.retrieve(priceId)
    const amountOk = price.unit_amount === toCents(expected)
    const currencyOk = (price.currency || 'usd') === 'usd'
    const noRecurringOk = !price.recurring // Should be one-time, no recurring
    results.push({ name, ok: amountOk && currencyOk && noRecurringOk, amountOk, currencyOk, noRecurringOk, current: price.unit_amount, expected: toCents(expected) })
  }

  await check('Try Once', 'TRY_ONCE', prices.tryOnce.price)
  await check('Individual', 'INDIVIDUAL', prices.individual.price)
  await check('Pro Small', 'PRO_SMALL', prices.proSmall.price)
  await check('Pro Large', 'PRO_LARGE', prices.proLarge.price)
  await check('Individual Top-Up', 'INDIVIDUAL_TOP_UP', prices.individualTopUp.price)
  await check('Pro Small Top-Up', 'PRO_SMALL_TOP_UP', prices.proSmallTopUp.price)
  await check('Pro Large Top-Up', 'PRO_LARGE_TOP_UP', prices.proLargeTopUp.price)
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
