import Stripe from 'stripe';
import fs from 'fs';
import path from 'path';
import dotenv from 'dotenv';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
dotenv.config();

const stripeSecretKey = process.env.STRIPE_SECRET_KEY;
if (!stripeSecretKey || stripeSecretKey.startsWith('your_')) {
  console.error('❌ Error: STRIPE_SECRET_KEY is missing or invalid in .env');
  process.exit(1);
}

const stripe = new Stripe(stripeSecretKey);

async function setupStripe() {
  console.log('⏳ Creating Stripe test products and prices...');
  
  try {
    // 1. Student Lite
    const studentLiteProd = await stripe.products.create({
      name: 'Student Lite',
      description: '150 credits / month, permanent exams, export to PDF/Docs',
    });
    const studentLitePrice = await stripe.prices.create({
      product: studentLiteProd.id,
      unit_amount: 300, // $3.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    console.log(`✅ Created Student Lite: ${studentLitePrice.id}`);

    // 2. Student Premium
    const studentPremiumProd = await stripe.products.create({
      name: 'Student Premium',
      description: '500 credits / month, credits roll over, priority AI, permanent exams',
    });
    const studentPremiumPrice = await stripe.prices.create({
      product: studentPremiumProd.id,
      unit_amount: 1000, // $10.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    console.log(`✅ Created Student Premium: ${studentPremiumPrice.id}`);

    // 3. Teacher Premium (corresponds to STRIPE_TEACHER_BASIC_PRICE_ID)
    const teacherPremiumProd = await stripe.products.create({
      name: 'Teacher Premium',
      description: '1,000 credits / month, permanent exams, bulk generation tools',
    });
    const teacherPremiumPrice = await stripe.prices.create({
      product: teacherPremiumProd.id,
      unit_amount: 1500, // $15.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    console.log(`✅ Created Teacher Premium (Basic): ${teacherPremiumPrice.id}`);

    // 4. Institutions (corresponds to STRIPE_TEACHER_PREMIUM_PRICE_ID)
    const institutionsProd = await stripe.products.create({
      name: 'Institutions',
      description: '10,000 credits / month, custom pedagogy fine-tuning, LMS integration',
    });
    const institutionsPrice = await stripe.prices.create({
      product: institutionsProd.id,
      unit_amount: 13500, // $135.00
      currency: 'usd',
      recurring: { interval: 'month' },
    });
    console.log(`✅ Created Institutions (Premium): ${institutionsPrice.id}`);

    // Read and update .env file
    const envPath = path.join(__dirname, '.env');
    let envContent = fs.readFileSync(envPath, 'utf8');

    envContent = envContent.replace(
      /STRIPE_STUDENT_LITE_PRICE_ID=.*/g,
      `STRIPE_STUDENT_LITE_PRICE_ID=${studentLitePrice.id}`
    );
    envContent = envContent.replace(
      /STRIPE_STUDENT_PREMIUM_PRICE_ID=.*/g,
      `STRIPE_STUDENT_PREMIUM_PRICE_ID=${studentPremiumPrice.id}`
    );
    envContent = envContent.replace(
      /STRIPE_TEACHER_BASIC_PRICE_ID=.*/g,
      `STRIPE_TEACHER_BASIC_PRICE_ID=${teacherPremiumPrice.id}`
    );
    envContent = envContent.replace(
      /STRIPE_TEACHER_PREMIUM_PRICE_ID=.*/g,
      `STRIPE_TEACHER_PREMIUM_PRICE_ID=${institutionsPrice.id}`
    );

    fs.writeFileSync(envPath, envContent, 'utf8');
    console.log('🎉 Successfully updated .env with real Stripe Price IDs!');

  } catch (error) {
    console.error('❌ Error during setup:', error);
  }
}

setupStripe();
