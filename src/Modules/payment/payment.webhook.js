import express from 'express';
import Stripe from 'stripe';
import UserModel from '../../DB/model/user.model.js';
import { sendInvoiceEmail } from '../../Utlis/sendEmail.js';

const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
const router = express.Router();

router.post('/', express.raw({ type: 'application/json' }), async (req, res) => {
  const sig = req.headers['stripe-signature'];
  let event;

  try {
    event = stripe.webhooks.constructEvent(req.body, sig, process.env.STRIPE_WEBHOOK_SECRET);
  } catch (err) {
    console.error(`❌ Webhook Signature Error: ${err.message}`);
    return res.status(400).send(`Webhook Error: ${err.message}`);
  }

  if (event.type === 'invoice.paid') {
    const invoice = event.data.object;
    const customerId = invoice.customer;
    const subscriptionId = invoice.subscription;
    const priceId = invoice.lines.data[0]?.price?.id;

    try {
      const user = await UserModel.findOne({ stripe_customer_id: customerId });
      if (user) {
        let planLabel = "Student Plan";
        
        if (priceId === process.env.STRIPE_STUDENT_LITE_PRICE_ID) {
          const creditsToAdd = 150;
          if (user.subscription_type === 'free') {
            user.subscription_credits = (user.subscription_credits || 0) + creditsToAdd;
          } else {
            user.subscription_credits = creditsToAdd;
          }
          user.subscription_type = 'lite';
          user.stripe_subscription_id = subscriptionId;
          user.grace_period_ends_at = null;
          planLabel = "Student Lite Subscription";
        } 
        
        else if (priceId === process.env.STRIPE_STUDENT_PREMIUM_PRICE_ID) {
          const creditsToAdd = 500;
          user.purchased_credits = (user.purchased_credits || 0) + creditsToAdd;
          user.subscription_type = 'premium';
          user.stripe_subscription_id = subscriptionId;
          user.grace_period_ends_at = null;
          planLabel = "Student Premium Subscription";
        }
        
        else if (priceId === process.env.STRIPE_TEACHER_BASIC_PRICE_ID) {
          const creditsToAdd = 1000;
          user.purchased_credits = (user.purchased_credits || 0) + creditsToAdd;
          user.subscription_type = 'premium';
          user.stripe_subscription_id = subscriptionId;
          user.grace_period_ends_at = null;
          planLabel = "Teacher Premium Subscription";
        }

        else if (priceId === process.env.STRIPE_TEACHER_PREMIUM_PRICE_ID) {
          const creditsToAdd = 10000;
          user.purchased_credits = (user.purchased_credits || 0) + creditsToAdd;
          user.subscription_type = 'institution';
          user.stripe_subscription_id = subscriptionId;
          user.grace_period_ends_at = null;
          planLabel = "Teacher Institutional Subscription";
        }

        await user.save();
        const invoiceUrl = invoice.hosted_invoice_url || "https://dashboard.stripe.com";
        const amountPaid = (invoice.amount_paid / 100).toFixed(2);
        await sendInvoiceEmail(user.email, invoiceUrl, planLabel, amountPaid);
      }
    } catch (dbErr) {
      console.error(`❌ Database Error during subscription handling: ${dbErr.message}`);
    }
  }

  if (event.type === 'invoice.payment_failed') {
    const invoice = event.data.object;
    const customerId = invoice.customer;

    try {
      const user = await UserModel.findOne({ stripe_customer_id: customerId });
      if (user) {
        user.grace_period_ends_at = new Date(Date.now() + 3 * 24 * 60 * 60 * 1000);
        await user.save();
      }
    } catch (dbErr) {
      console.error(`❌ Database Error during payment failure handling: ${dbErr.message}`);
    }
  }

  if (event.type === 'payment_intent.succeeded') {
    const paymentIntent = event.data.object;
    const { userId, type, creditsToAdd, planName } = paymentIntent.metadata;

    if (userId && creditsToAdd) {
      try {
        const user = await UserModel.findById(userId);
        if (user) {
          const credits = parseInt(creditsToAdd, 10);

          if (user.role === 'Teacher') {
            user.purchased_credits += credits;
            if (type === 'teacher_plan') {
              user.subscription_type = planName;
            }
          } else if (user.role === 'Student' && type === 'addon_credits') {
            user.purchased_credits += credits;
          }

          await user.save();

          // Send Invoice / Receipt Email
          const receiptUrl = paymentIntent.charges?.data?.[0]?.receipt_url || "https://dashboard.stripe.com";
          const amountPaid = (paymentIntent.amount / 100).toFixed(2);
          const productName = type === 'teacher_plan' 
            ? `Teacher ${planName.charAt(0).toUpperCase() + planName.slice(1)} Plan` 
            : `${credits} Credits Add-on`;

          await sendInvoiceEmail(user.email, receiptUrl, productName, amountPaid);
        }
      } catch (dbErr) {
        console.error(`❌ Database Error during one-time credit top-up: ${dbErr.message}`);
      }
    }
  }

  res.status(200).json({ received: true });
});

export default router;