import nodemailer from "nodemailer";
import dotenv from "dotenv";

dotenv.config();

export const sendEmail = async (to, otp) => {
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
        <div style="max-width: 500px; margin: 0 auto; background-color: #ffffff; padding: 30px; border-radius: 12px; box-shadow: 0 4px 10px rgba(0,0,0,0.05);">
          <h1 style="color: #111827; margin-bottom: 5px; font-size: 28px;">Academix</h1>
          <h2 style="color: #374151; font-size: 18px; margin-bottom: 25px; font-weight: normal;">Verify Your Account</h2>
          <p style="color: #4b5563; font-size: 16px; line-height: 1.6; margin-bottom: 30px;">
            Welcome to Academix! To complete your registration, please enter the verification code below:
          </p>
          <div style="background-color: #f3f4f6; padding: 15px 30px; border-radius: 8px; display: inline-block; margin-bottom: 30px;">
            <span style="font-size: 32px; font-weight: bold; color: #111827; letter-spacing: 6px;">${otp}</span>
          </div>
          <p style="color: #9ca3af; font-size: 12px;">If you didn't try to create an account, safely ignore this email.</p>
        </div>
      </div>
    `;

    await transporter.sendMail({
      from: `"Academix" <academixai2026@gmail.com>`,
      to,
      subject: " Verify your Academix account",
      html: emailHTML,
    });

    console.log(`Verification email sent successfully to: ${to}`);
  } catch (error) {
    console.error(" Email error:", error.message);
    throw new Error("Failed to send verification email");
  }
};