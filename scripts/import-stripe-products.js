#!/usr/bin/env node

// Load environment variables from .env.local
require('dotenv').config({ path: '.env' });

const Stripe = require('stripe');

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

async function createProducts() {
  console.log('🚀 Creating Stripe products and prices...');

  try {
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
      unit_amount: 500, // $5.00 in cents
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
      unit_amount: 2400, // $24.00 in cents
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: {
        type: 'individual',
        period: 'monthly',
        credits: '60'
      }
    });

    // Annual
    const individualAnnualPrice = await stripe.prices.create({
      product: individualProduct.id,
      unit_amount: 1900, // $228.00 in cents
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: {
        type: 'individual',
        period: 'annual',
        credits: '60'
      }
    });

    console.log(`✅ Individual Monthly - Price ID: ${individualMonthlyPrice.id}`);
    console.log(`✅ Individual Annual - Price ID: ${individualAnnualPrice.id}`);

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
      unit_amount: 5900, // $59.00 in cents
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: {
        type: 'pro',
        period: 'monthly',
        credits: '200'
      }
    });

    // Annual
    const proAnnualPrice = await stripe.prices.create({
      product: proProduct.id,
      unit_amount: 4900, // $49.00 in cents
      currency: 'usd',
      recurring: { interval: 'month' },
      metadata: {
        type: 'pro',
        period: 'annual',
        credits: '200'
      }
    });

    console.log(`✅ Pro Monthly - Price ID: ${proMonthlyPrice.id}`);
    console.log(`✅ Pro Annual - Price ID: ${proAnnualPrice.id}`);

    // Output config snippet for PRICE_IDS in src/config/pricing.ts
    console.log('\n📋 Add these IDs to PRICE_IDS in src/config/pricing.ts:');
    console.log('TRY_ONCE:', `["${tryOncePrice.id}"]`);
    console.log('INDIVIDUAL_MONTHLY:', `["${individualMonthlyPrice.id}"]`);
    console.log('INDIVIDUAL_ANNUAL:', `["${individualAnnualPrice.id}"]`);
    console.log('PRO_MONTHLY:', `["${proMonthlyPrice.id}"]`);
    console.log('PRO_ANNUAL:', `["${proAnnualPrice.id}"]`);

    console.log('\n✅ All products and prices created successfully!');

  } catch (error) {
    console.error('❌ Error creating products:', error);
    process.exit(1);
  }
}

createProducts();
