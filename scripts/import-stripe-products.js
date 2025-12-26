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

  // Parse seats volume tiers from config
  const seatsSection = content.match(/seats:\s*\{[\s\S]*?volumeTiers:\s*\[([\s\S]*?)\]/);
  const volumeTiers = [];
  if (seatsSection) {
    const tiersStr = seatsSection[1];
    const tierMatches = tiersStr.matchAll(/\{\s*min:\s*(\d+),\s*max:\s*(\w+),\s*pricePerSeat:\s*([0-9.]+)\s*\}/g);
    for (const match of tierMatches) {
      volumeTiers.push({
        min: Number(match[1]),
        max: match[2] === 'Infinity' ? null : Number(match[2]),
        pricePerSeat: Number(match[3])
      });
    }
  }

  const creditsPerSeat = num(/creditsPerSeat:\s*([0-9]+)/);
  const photosPerSeat = num(/photosPerSeat:\s*([0-9]+)/);

  return {
    ids,
    prices: {
      individual: { price: num(/individual:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/individual:[\s\S]*?credits:\s*([0-9]+)/) },
      individualTopUp: { price: num(/individual:[\s\S]*?topUp:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/individual:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
      vip: { price: num(/vip:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/vip:[\s\S]*?credits:\s*([0-9]+)/) },
      vipTopUp: { price: num(/vip:[\s\S]*?topUp:\s*\{\s*price:\s*([0-9.]+)/), credits: num(/vip:[\s\S]*?topUp:[\s\S]*?credits:\s*([0-9]+)/) },
    },
    seats: {
      volumeTiers,
      creditsPerSeat,
      photosPerSeat
    }
  }
}

/**
 * Find existing product by metadata type, or create if not found
 */
async function findOrCreateProduct(name, description, metadata) {
  // Search for existing product by metadata
  const existingProducts = await stripe.products.list({
    limit: 100,
  });

  const existing = existingProducts.data.find(p =>
    p.metadata?.type === metadata.type &&
    (metadata.tier ? p.metadata?.tier === metadata.tier : true)
  );

  if (existing) {
    console.log(`   Found existing product: ${existing.id}`);
    return existing;
  }

  console.log(`   Creating new product...`);
  return await stripe.products.create({
    name,
    description,
    metadata
  });
}

/**
 * Find existing price for product with matching amount, or create if not found
 */
async function findOrCreatePrice(product, unitAmount, metadata) {
  // List prices for this product
  const prices = await stripe.prices.list({
    product: product.id,
    limit: 100,
  });

  const existing = prices.data.find(p =>
    p.unit_amount === unitAmount &&
    p.currency === 'usd' &&
    !p.recurring
  );

  if (existing) {
    console.log(`   Found existing price: ${existing.id}`);
    return existing;
  }

  console.log(`   Creating new price...`);
  return await stripe.prices.create({
    product: product.id,
    unit_amount: unitAmount,
    currency: 'usd',
    metadata
  });
}

async function createProducts() {
  console.log('🚀 Checking and creating Stripe products and prices (one-time transactional)...');

  try {
    // Read pricing from src/config/pricing.ts to avoid drift
    const read = readPricingConfigTs()

    // 1. Individual Product (one-time)
    console.log('📦 Individual product...');
    const individualProduct = await findOrCreateProduct(
      'Individual Plan - 4 customized photos, generated 2x',
      'One-time purchase for personal photo generation (8 photos, 4 customizations)',
      {
        type: 'individual',
        credits: '40'
      }
    );

    const individualPrice = await findOrCreatePrice(
      individualProduct,
      toCents(read.prices.individual?.price ?? 19.99),
      {
        type: 'individual',
        credits: '40'
      }
    );

    console.log(`✅ Individual - Price ID: ${individualPrice.id}`);

    // 2. VIP Product (one-time - Individual domain anchor)
    console.log('📦 VIP product...');
    const vipProduct = await findOrCreateProduct(
      'VIP Plan - 25 customized photos, generated 4x',
      'Premium individual plan for personal branding (100 photos, 25 customizations)',
      {
        type: 'vip',
        credits: '250',
        maxTeamMembers: 'unlimited'
      }
    );

    const vipPrice = await findOrCreatePrice(
      vipProduct,
      toCents(read.prices.vip?.price ?? 199.99),
      {
        type: 'vip',
        credits: '250',
        maxTeamMembers: 'unlimited'
      }
    );

    console.log(`✅ VIP - Price ID: ${vipPrice.id}`);

    // 3. Team Seats Product (one-time with volume pricing)
    console.log('📦 Team Seats product...');
    const teamSeatsProduct = await findOrCreateProduct(
      'TeamShots - Team Seats',
      `Professional headshots for your team with volume discounts (${read.seats.photosPerSeat} photos per seat)`,
      {
        type: 'team_seats',
        credits_per_seat: String(read.seats.creditsPerSeat),
        photos_per_seat: String(read.seats.photosPerSeat)
      }
    );

    // Convert config volumeTiers to Stripe tiers format
    // Config tiers are sorted from highest to lowest tier (25+, 10-24, 1-9)
    // Stripe tiers must be sorted from lowest to highest (1-9, 10-24, 25+)
    const stripeTiers = read.seats.volumeTiers
      .slice()
      .reverse()
      .map(tier => ({
        up_to: tier.max,
        unit_amount: toCents(tier.pricePerSeat)
      }));

    // Check for existing tiered price
    const existingSeatsPrice = (await stripe.prices.list({
      product: teamSeatsProduct.id,
      limit: 100,
    })).data.find(p =>
      p.currency === 'usd' &&
      p.billing_scheme === 'tiered' &&
      p.tiers_mode === 'volume'
    );

    const teamSeatsPrice = existingSeatsPrice || await stripe.prices.create({
      product: teamSeatsProduct.id,
      currency: 'usd',
      billing_scheme: 'tiered',
      tiers_mode: 'volume', // CRITICAL: Tier price applies to ALL units
      tiers: stripeTiers,
      metadata: {
        type: 'team_seats',
        credits_per_seat: String(read.seats.creditsPerSeat),
        photos_per_seat: String(read.seats.photosPerSeat)
      }
    });

    if (existingSeatsPrice) {
      console.log(`   Found existing tiered price: ${teamSeatsPrice.id}`);
    } else {
      console.log(`   Created new tiered price: ${teamSeatsPrice.id}`);
    }

    console.log(`✅ Team Seats - Price ID: ${teamSeatsPrice.id}`);

    // 4. Top-up products (one-time)
    console.log('📦 Top-Up products...')

    console.log('   Individual Top-Up...');
    const individualTopUpProduct = await findOrCreateProduct(
      'Individual Top-Up - 4 photos',
      'One-time purchase of 4 photos (individual)',
      { type: 'top_up', tier: 'individual' }
    );
    const individualTopUpPrice = await findOrCreatePrice(
      individualTopUpProduct,
      toCents(read.prices.individualTopUp?.price ?? 19.99),
      { type: 'top_up', tier: 'individual', credits: '40' }
    );

    console.log('   VIP Top-Up...');
    const vipTopUpProduct = await findOrCreateProduct(
      'VIP Top-Up - 10 photos',
      'One-time purchase of 10 photos for VIP users',
      { type: 'top_up', tier: 'vip' }
    );
    const vipTopUpPrice = await findOrCreatePrice(
      vipTopUpProduct,
      toCents(read.prices.vipTopUp?.price ?? 69.99),
      { type: 'top_up', tier: 'vip', credits: '100' }
    );

    // Output config snippet for PRICE_IDS in src/config/pricing.ts
    console.log('\n📋 Add these IDs to TEST_STRIPE_PRICE_IDS and PROD_STRIPE_PRICE_IDS in src/config/pricing.ts:');
    console.log('INDIVIDUAL:', `"${individualPrice.id}"`);
    console.log('VIP:', `"${vipPrice.id}"`);
    console.log('TEAM_SEATS:', `"${teamSeatsPrice.id}"`);
    console.log('INDIVIDUAL_TOP_UP:', `"${individualTopUpPrice.id}"`);
    console.log('VIP_TOP_UP:', `"${vipTopUpPrice.id}"`);

    console.log('\n✅ All products and prices checked/created successfully!');

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
  await check('VIP', 'VIP', prices.vip.price)
  await check('Individual Top-Up', 'INDIVIDUAL_TOP_UP', prices.individualTopUp.price)
  await check('VIP Top-Up', 'VIP_TOP_UP', prices.vipTopUp.price)

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
