import Stripe from 'stripe';
import dotenv from 'dotenv';
import UserModel from '../../DB/model/user.model.js';

dotenv.config();
// Initialize Stripe client
const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

export const createSubscriptionIntent = async (req, res) => {
  let { priceId, plan, userEmail, userId } = req.body;

  if (plan && !priceId) {
    if (plan === "lite") {
      priceId = process.env.STRIPE_STUDENT_LITE_PRICE_ID;
    } else if (plan === "premium") {
      priceId = process.env.STRIPE_STUDENT_PREMIUM_PRICE_ID;
    } else if (plan === "teacher_basic") {
      priceId = process.env.STRIPE_TEACHER_BASIC_PRICE_ID;
    } else if (plan === "teacher_premium") {
      priceId = process.env.STRIPE_TEACHER_PREMIUM_PRICE_ID;
    }
  }

  try {
    const user = await UserModel.findById(userId);
    if (!user) {
      return res.status(404).json({ message: "User not found in the system" });
    }

    let stripeCustomerId = user.stripe_customer_id;
    if (!stripeCustomerId) {
      const customer = await stripe.customers.create({
        email: userEmail,
        metadata: { userId: userId.toString() }
      });
      stripeCustomerId = customer.id;
      user.stripe_customer_id = stripeCustomerId;
      await user.save();
    }

    const createSubscription = async (customerId) => {
      return await stripe.subscriptions.create({
        customer: customerId,
        items: [{ price: priceId }],
        payment_behavior: 'default_incomplete',
        payment_settings: { save_default_payment_method: 'on_subscription' },
        expand: ['latest_invoice.confirmation_secret'],
      });
    };

    let subscription;
    try {
      subscription = await createSubscription(stripeCustomerId);
    } catch (subErr) {
      // Self-healing: If customer is missing/deleted from Stripe, recreate it and retry
      if (subErr.code === 'resource_missing' || subErr.message.includes('No such customer')) {
        console.log(`⚠️ Stripe customer ${stripeCustomerId} not found. Re-creating...`);
        const customer = await stripe.customers.create({
          email: userEmail,
          metadata: { userId: userId.toString() }
        });
        stripeCustomerId = customer.id;
        user.stripe_customer_id = stripeCustomerId;
        await user.save();
        subscription = await createSubscription(stripeCustomerId);
      } else {
        throw subErr;
      }
    }

    // Stripe API 2025+: client_secret is now in confirmation_secret (not payment_intent)
    const clientSecret = subscription.latest_invoice?.confirmation_secret?.client_secret;
    if (!clientSecret) {
      console.error('❌ No client_secret in confirmation_secret. Invoice:', subscription.latest_invoice);
      return res.status(500).json({ error: 'Payment setup failed: no client_secret from Stripe.' });
    }

    res.status(200).json({
      subscriptionId: subscription.id,
      clientSecret,
    });
  } catch (error) {
    console.error('❌ createSubscriptionIntent error:', error);
    res.status(500).json({ error: error.message });
  }
};

export const createAddonIntent = async (req, res) => {
  const { totalCostInDollars, amountOfCredits, userId, planName } = req.body;

  try {
    const paymentIntent = await stripe.paymentIntents.create({
      amount: Math.round(totalCostInDollars * 100), 
      currency: 'usd',
      metadata: {
        userId: userId.toString(),
        type: planName ? 'teacher_plan' : 'addon_credits', 
        creditsToAdd: amountOfCredits.toString(),
        planName: planName || ''
      }
    });
    res.status(200).json({
      clientSecret: paymentIntent.client_secret,
    });
  } catch (error) {
    res.status(500).json({ error: error.message });
  }
};

export const stripePublishableKey =async (req, res) => {
  res.status(200).json({
    publishableKey: process.env.STRIPE_PUBLISHABLE_KEY
  });
}