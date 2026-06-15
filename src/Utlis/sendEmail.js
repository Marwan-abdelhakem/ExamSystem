import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const sendEmail = async (to, otp, purpose = "verify") => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const isReset = purpose === "reset";
    const subject = isReset ? "Reset your Academix account password" : "Verify your Academix account";
    const headerTitle = isReset ? "Reset Your Password" : "Verify Your Account";
    const bodyText = isReset
      ? "We received a request to reset your password. Please enter the verification code below to complete the reset process:"
      : "Welcome to Academix! To complete your registration, please enter the verification code below:";
    const footerText = isReset
      ? "If you didn't request a password reset, safely ignore this email."
      : "If you didn't try to create an account, safely ignore this email.";

    const emailHTML = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9fa; padding: 40px 20px; text-align: center;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          <h1 style="color: #111827; margin-bottom: 5px; font-size: 28px;">Academix</h1>
          <h2 style="color: #374151; font-size: 18px; margin-bottom: 25px; font-weight: normal;">${headerTitle}</h2>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            ${bodyText}
          </p>
          <div style="background-color: #f3f4f6; padding: 15px 30px; border-radius: 8px; display: inline-block; margin-bottom: 30px;">
            <span style="font-size: 32px; font-weight: bold; color: #111827; letter-spacing: 6px;">${otp}</span>
          </div>
          <p style="color: #9ca3af; font-size: 12px;">${footerText}</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Academix" <academixai2026@gmail.com>`,
      to,
      subject,
      html: emailHTML,
    });

    console.log(`Email (${purpose}) sent successfully to: ${to}`);
  } catch (error) {
    console.error(`Email (${purpose}) error:`, error.message);
    throw new Error(`Failed to send ${purpose} email`);
  }
};

export const sendInvoiceEmail = async (to, invoiceUrl, planName, amountPaid) => {
  try {
    const transporter = nodemailer.createTransport({
      host: "smtp-relay.brevo.com",
      port: 587,
      secure: false,
      auth: {
        user: process.env.SMTP_USER,
        pass: process.env.SMTP_PASS,
      },
    });

    const emailHTML = `
      <div style="font-family: 'Segoe UI', Tahoma, Geneva, Verdana, sans-serif; background-color: #f9f9fa; padding: 40px 20px; text-align: center;">
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05); text-align: left;">
          <h1 style="color: #111827; margin-bottom: 5px; font-size: 28px; text-align: center;">Academix</h1>
          <h2 style="color: #10b981; font-size: 20px; margin-bottom: 25px; font-weight: bold; text-align: center;">Payment Successful!</h2>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 20px;">
            Thank you for your purchase! We've received your payment of <strong>$${amountPaid}</strong> for the <strong>${planName}</strong>.
          </p>
          <div style="background-color: #f3f4f6; padding: 20px; border-radius: 8px; margin-bottom: 25px;">
            <p style="margin: 0; font-size: 14px; color: #4b5563;"><strong>Plan / Product:</strong> ${planName}</p>
            <p style="margin: 5px 0 0 0; font-size: 14px; color: #4b5563;"><strong>Amount Paid:</strong> $${amountPaid}</p>
          </div>
          <p style="color: #4b5563; font-size: 15px; margin-bottom: 25px;">
            You can view or download your official invoice/receipt by clicking the button below:
          </p>
          <div style="text-align: center; margin-bottom: 30px;">
            <a href="${invoiceUrl}" target="_blank" style="background-color: #4f46e5; color: #ffffff; padding: 12px 30px; border-radius: 8px; text-decoration: none; font-weight: bold; display: inline-block;">View Invoice & Receipt</a>
          </div>
          <p style="color: #9ca3af; font-size: 12px; text-align: center;">If you have any questions, please reply to this email.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Academix" <academixai2026@gmail.com>`,
      to,
      subject: "Your Academix Invoice & Receipt",
      html: emailHTML,
    });

    console.log(`Invoice email sent successfully to: ${to}`);
  } catch (error) {
    console.error("📧 Invoice email error:", error.message);
  }
};