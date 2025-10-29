import { test, expect } from '@playwright/test'

test.describe('Stripe Webhook Handling', () => {
  test('should handle checkout.session.completed for subscription', async ({ request }) => {
    const webhookPayload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123',
          mode: 'subscription',
          customer: 'cus_test_123',
          subscription: 'sub_test_123',
          metadata: {
            userType: 'individual',
            planTier: 'individual',
            planPeriod: 'monthly'
          }
        }
      }
    }

    const response = await request.post('/api/stripe/webhook', {
      data: webhookPayload,
      headers: {
        'stripe-signature': 'test_signature'
      }
    })

    expect(response.status()).toBe(200)
  })

  test('should handle checkout.session.completed for try once purchase', async ({ request }) => {
    const webhookPayload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_456',
          mode: 'payment',
          customer: 'cus_test_456',
          payment_intent: 'pi_test_456',
          metadata: {
            userType: 'individual',
            planTier: 'try_once',
            planPeriod: 'one_time'
          }
        }
      }
    }

    const response = await request.post('/api/stripe/webhook', {
      data: webhookPayload,
      headers: {
        'stripe-signature': 'test_signature'
      }
    })

    expect(response.status()).toBe(200)
  })

  test('should handle credit top-up purchase', async ({ request }) => {
    const webhookPayload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_789',
          mode: 'payment',
          customer: 'cus_test_789',
          payment_intent: 'pi_test_789',
          metadata: {
            userType: 'individual',
            planTier: 'try_once',
            planPeriod: 'one_time',
            creditTopup: 'true',
            credits: '20'
          }
        }
      }
    }

    const response = await request.post('/api/stripe/webhook', {
      data: webhookPayload,
      headers: {
        'stripe-signature': 'test_signature'
      }
    })

    expect(response.status()).toBe(200)
  })

  test('should handle subscription schedule created', async ({ request }) => {
    const webhookPayload = {
      type: 'subscription_schedule.created',
      data: {
        object: {
          id: 'sub_sched_test_123',
          subscription: 'sub_test_123',
          metadata: {
            contract_start: '2024-01-01',
            contract_end: '2024-12-31'
          }
        }
      }
    }

    const response = await request.post('/api/stripe/webhook', {
      data: webhookPayload,
      headers: {
        'stripe-signature': 'test_signature'
      }
    })

    expect(response.status()).toBe(200)
  })

  test('should handle invoice.payment_succeeded for monthly renewal', async ({ request }) => {
    const webhookPayload = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_test_123',
          customer: 'cus_test_123',
          subscription: 'sub_test_123',
          amount_paid: 2400, // $24.00
          metadata: {
            planTier: 'individual',
            planPeriod: 'monthly'
          }
        }
      }
    }

    const response = await request.post('/api/stripe/webhook', {
      data: webhookPayload,
      headers: {
        'stripe-signature': 'test_signature'
      }
    })

    expect(response.status()).toBe(200)
  })

  test('should handle invoice.payment_succeeded for credit top-up', async ({ request }) => {
    const webhookPayload = {
      type: 'invoice.payment_succeeded',
      data: {
        object: {
          id: 'in_test_456',
          customer: 'cus_test_456',
          amount_paid: 890, // $8.90
          metadata: {
            credit_topup: 'true',
            credits: '20',
            tier: 'try_once'
          }
        }
      }
    }

    const response = await request.post('/api/stripe/webhook', {
      data: webhookPayload,
      headers: {
        'stripe-signature': 'test_signature'
      }
    })

    expect(response.status()).toBe(200)
  })

  test('should handle subscription updated', async ({ request }) => {
    const webhookPayload = {
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_test_123',
          customer: 'cus_test_123',
          status: 'active',
          metadata: {
            planTier: 'pro',
            planPeriod: 'monthly'
          }
        }
      }
    }

    const response = await request.post('/api/stripe/webhook', {
      data: webhookPayload,
      headers: {
        'stripe-signature': 'test_signature'
      }
    })

    expect(response.status()).toBe(200)
  })

  test('should handle subscription deleted', async ({ request }) => {
    const webhookPayload = {
      type: 'customer.subscription.deleted',
      data: {
        object: {
          id: 'sub_test_123',
          customer: 'cus_test_123',
          status: 'canceled'
        }
      }
    }

    const response = await request.post('/api/stripe/webhook', {
      data: webhookPayload,
      headers: {
        'stripe-signature': 'test_signature'
      }
    })

    expect(response.status()).toBe(200)
  })

  test('should reject webhook with invalid signature', async ({ request }) => {
    const webhookPayload = {
      type: 'checkout.session.completed',
      data: {
        object: {
          id: 'cs_test_123'
        }
      }
    }

    const response = await request.post('/api/stripe/webhook', {
      data: webhookPayload,
      headers: {
        'stripe-signature': 'invalid_signature'
      }
    })

    expect(response.status()).toBe(400)
  })

  test('should handle unknown webhook events gracefully', async ({ request }) => {
    const webhookPayload = {
      type: 'unknown.event.type',
      data: {
        object: {
          id: 'test_123'
        }
      }
    }

    const response = await request.post('/api/stripe/webhook', {
      data: webhookPayload,
      headers: {
        'stripe-signature': 'test_signature'
      }
    })

    expect(response.status()).toBe(200)
  })
})
