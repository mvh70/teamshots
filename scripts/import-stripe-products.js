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
  const idMatch = content.match(/const TEST_STRIPE_PRICE_IDS = \{[\s\S]*?\}/);
  if (idMatch) {
    const entries = idMatch[0].match(/([A-Z0-9_]+):\s*"([^"]*)"/g) || [];
    entries.forEach((e) => {
      const [, key, val] = e.match(/([A-Z0-9_]+):\s*"([^"]*)"/) || [];
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
      individual: { price: num(/individual:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/individual:[\s\S]*?credits:\s*([0-9]+)/) },
      individualTopUp: { price: num(/individual:[\s\S]*?topUp:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/individual:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
      proSmall: { price: num(/proSmall:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/proSmall:[\s\S]*?credits:\s*([0-9]+)/) },
      proSmallTopUp: { price: num(/proSmall:[\s\S]*?topUp:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/proSmall:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
      proLarge: { price: num(/proLarge:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/proLarge:[\s\S]*?credits:\s*([0-9]+)/) },
      proLargeTopUp: { price: num(/proLarge:[\s\S]*?topUp:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/proLarge:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
      vip: { price: num(/vip:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/vip:[\s\S]*?credits:\s*([0-9]+)/) },
      vipTopUp: { price: num(/vip:[\s\S]*?topUp:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/vip:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
      enterprise: { price: num(/enterprise:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/enterprise:[\s\S]*?credits:\s*([0-9]+)/) },
      enterpriseTopUp: { price: num(/enterprise:[\s\S]*?topUp:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/enterprise:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
    }
  }
}

async function createProducts() {
  console.log('🚀 Creating Stripe products and prices (one-time transactional)...');

  try {
    // Read pricing from src/config/pricing.ts to avoid drift
    const read = readPricingConfigTs()

    // 1. Individual Product (one-time)
    console.log('📦 Creating Individual product...');
    const individualProduct = await stripe.products.create({
      name: 'Individual Plan - 4 customized photos, generated 2x',
      description: 'One-time purchase for personal photo generation (8 photos, 4 customizations)',
      metadata: {
        type: 'individual',
        credits: '40'
      }
    });

    const individualPrice = await stripe.prices.create({
      product: individualProduct.id,
      unit_amount: toCents(read.prices.individual?.price ?? 19.99),
      currency: 'usd',
      metadata: {
        type: 'individual',
        credits: '40'
      }
    });

    console.log(`✅ Individual - Price ID: ${individualPrice.id}`);

    // 2. Pro Small Product (up to 5 team members - one-time)
    console.log('📦 Creating Pro Small product...');
    const proSmallProduct = await stripe.products.create({
      name: 'Pro Small Plan - 4 customized photos, generated 2x',
      description: 'One-time purchase for teams up to 5 members (8 photos, 4 customizations)',
      metadata: {
        type: 'pro_small',
        credits: '40',
        maxTeamMembers: '5'
      }
    });

    const proSmallPrice = await stripe.prices.create({
      product: proSmallProduct.id,
      unit_amount: toCents(read.prices.proSmall?.price ?? 19.99),
      currency: 'usd',
      metadata: {
        type: 'pro_small',
        credits: '40',
        maxTeamMembers: '5'
      }
    });

    console.log(`✅ Pro Small - Price ID: ${proSmallPrice.id}`);

    // 3. Pro Large Product (more than 5 team members - one-time)
    console.log('📦 Creating Pro Large product...');
    const proLargeProduct = await stripe.products.create({
      name: 'Pro Large Plan - 10 customized photos, generated 3x',
      description: 'One-time purchase for teams with more than 5 members (30 photos, 10 customizations)',
      metadata: {
        type: 'pro_large',
        credits: '100',
        maxTeamMembers: 'unlimited'
      }
    });

    const proLargePrice = await stripe.prices.create({
      product: proLargeProduct.id,
      unit_amount: toCents(read.prices.proLarge?.price ?? 59.99),
      currency: 'usd',
      metadata: {
        type: 'pro_large',
        credits: '100'
      }
    });

    console.log(`✅ Pro Large - Price ID: ${proLargePrice.id}`);

    // 4. VIP Product (one-time - Individual domain anchor)
    console.log('📦 Creating VIP product...');
    const vipProduct = await stripe.products.create({
      name: 'VIP Plan - 25 customized photos, generated 4x',
      description: 'Premium individual plan for personal branding (100 photos, 25 customizations)',
      metadata: {
        type: 'vip',
        credits: '250',
        maxTeamMembers: 'unlimited'
      }
    });

    const vipPrice = await stripe.prices.create({
      product: vipProduct.id,
      unit_amount: toCents(read.prices.vip?.price ?? 199.99),
      currency: 'usd',
      metadata: {
        type: 'vip',
        credits: '250',
        maxTeamMembers: 'unlimited'
      }
    });

    console.log(`✅ VIP - Price ID: ${vipPrice.id}`);

    // 5. Enterprise Product (one-time - Team domain anchor)
    console.log('📦 Creating Enterprise product...');
    const enterpriseProduct = await stripe.products.create({
      name: 'Enterprise Plan - 60 customized photos, generated 4x',
      description: 'Enterprise team plan for professional branding (240 photos, 60 customizations)',
      metadata: {
        type: 'enterprise',
        credits: '600',
        maxTeamMembers: 'unlimited'
      }
    });

    const enterprisePrice = await stripe.prices.create({
      product: enterpriseProduct.id,
      unit_amount: toCents(read.prices.enterprise?.price ?? 399.99),
      currency: 'usd',
      metadata: {
        type: 'enterprise',
        credits: '600',
        maxTeamMembers: 'unlimited'
      }
    });

    console.log(`✅ Enterprise - Price ID: ${enterprisePrice.id}`);

    // 6. Top-up products (one-time)
    console.log('📦 Creating Top-Up products...')

    const individualTopUpProduct = await stripe.products.create({
      name: 'Individual Top-Up - 4 photos',
      description: 'One-time purchase of 4 photos (individual)',
      metadata: { type: 'top_up', tier: 'individual' }
    })
    const individualTopUpPrice = await stripe.prices.create({
      product: individualTopUpProduct.id,
      unit_amount: toCents(read.prices.individualTopUp?.price ?? 19.99),
      currency: 'usd',
      metadata: { type: 'top_up', tier: 'individual', credits: '40' }
    })

    const proSmallTopUpProduct = await stripe.products.create({
      name: 'Pro Small Top-Up - 5 photos',
      description: 'One-time purchase of 5 photos (pro small)',
      metadata: { type: 'top_up', tier: 'pro_small' }
    })
    const proSmallTopUpPrice = await stripe.prices.create({
      product: proSmallTopUpProduct.id,
      unit_amount: toCents(read.prices.proSmallTopUp?.price ?? 22.49),
      currency: 'usd',
      metadata: { type: 'top_up', tier: 'pro_small', credits: '50' }
    })

    const proLargeTopUpProduct = await stripe.products.create({
      name: 'Pro Large Top-Up - 7 Photos',
      description: 'One-time purchase of 7 photos for Pro Large users',
      metadata: { type: 'top_up', tier: 'pro_large' }
    })
    const proLargeTopUpPrice = await stripe.prices.create({
      product: proLargeTopUpProduct.id,
      unit_amount: toCents(read.prices.proLargeTopUp?.price ?? 36.99),
      currency: 'usd',
      metadata: { type: 'top_up', tier: 'pro_large', credits: '70' }
    })

    const vipTopUpProduct = await stripe.products.create({
      name: 'VIP Top-Up - 10 photos',
      description: 'One-time purchase of 10 photos for VIP users',
      metadata: { type: 'top_up', tier: 'vip' }
    })
    const vipTopUpPrice = await stripe.prices.create({
      product: vipTopUpProduct.id,
      unit_amount: toCents(read.prices.vipTopUp?.price ?? 69.99),
      currency: 'usd',
      metadata: { type: 'top_up', tier: 'vip', credits: '100' }
    })

    const enterpriseTopUpProduct = await stripe.products.create({
      name: 'Enterprise Top-Up - 25 photos',
      description: 'One-time purchase of 25 photos for Enterprise users',
      metadata: { type: 'top_up', tier: 'enterprise' }
    })
    const enterpriseTopUpPrice = await stripe.prices.create({
      product: enterpriseTopUpProduct.id,
      unit_amount: toCents(read.prices.enterpriseTopUp?.price ?? 149.99),
      currency: 'usd',
      metadata: { type: 'top_up', tier: 'enterprise', credits: '250' }
    })

    // Output config snippet for PRICE_IDS in src/config/pricing.ts
    console.log('\n📋 Add these IDs to TEST_STRIPE_PRICE_IDS and PROD_STRIPE_PRICE_IDS in src/config/pricing.ts:');
    console.log('INDIVIDUAL:', `"${individualPrice.id}"`);
    console.log('PRO_SMALL:', `"${proSmallPrice.id}"`);
    console.log('PRO_LARGE:', `"${proLargePrice.id}"`);
    console.log('VIP:', `"${vipPrice.id}"`);
    console.log('ENTERPRISE:', `"${enterprisePrice.id}"`);
    console.log('INDIVIDUAL_TOP_UP:', `"${individualTopUpPrice.id}"`);
    console.log('PRO_SMALL_TOP_UP:', `"${proSmallTopUpPrice.id}"`);
    console.log('PRO_LARGE_TOP_UP:', `"${proLargeTopUpPrice.id}"`);
    console.log('VIP_TOP_UP:', `"${vipTopUpPrice.id}"`);
    console.log('ENTERPRISE_TOP_UP:', `"${enterpriseTopUpPrice.id}"`);

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

  await check('Individual', 'INDIVIDUAL', prices.individual.price)
  await check('Pro Small', 'PRO_SMALL', prices.proSmall.price)
  await check('Pro Large', 'PRO_LARGE', prices.proLarge.price)
  await check('VIP', 'VIP', prices.vip.price)
  await check('Enterprise', 'ENTERPRISE', prices.enterprise.price)
  await check('Individual Top-Up', 'INDIVIDUAL_TOP_UP', prices.individualTopUp.price)
  await check('Pro Small Top-Up', 'PRO_SMALL_TOP_UP', prices.proSmallTopUp.price)
  await check('Pro Large Top-Up', 'PRO_LARGE_TOP_UP', prices.proLargeTopUp.price)
  await check('VIP Top-Up', 'VIP_TOP_UP', prices.vipTopUp.price)
  await check('Enterprise Top-Up', 'ENTERPRISE_TOP_UP', prices.enterpriseTopUp.price)

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
