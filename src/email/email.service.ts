import { Injectable, Logger } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as nodemailer from 'nodemailer';

@Injectable()
export class EmailService {
  private readonly logger = new Logger(EmailService.name);
  private transporter: nodemailer.Transporter | null = null;

  constructor(private readonly configService: ConfigService) {
    this.initTransporter();
  }

  private initTransporter() {
    const user =
      this.configService.get<string>('SMTP_USER') || process.env.SMTP_USER;
    const pass =
      this.configService.get<string>('SMTP_PASS') || process.env.SMTP_PASS;
    const host =
      this.configService.get<string>('SMTP_HOST') ||
      process.env.SMTP_HOST ||
      'smtp.gmail.com';
    const port = Number(
      this.configService.get<string>('SMTP_PORT') ||
      process.env.SMTP_PORT ||
      465,
    );
    const secure =
      (this.configService.get<string>('SMTP_SECURE') ||
        process.env.SMTP_SECURE ||
        'true') === 'true';

    if (!user || !pass || user.includes('your-email') || pass.includes('your-app-password')) {
      this.logger.warn(
        'SMTP_USER or SMTP_PASS is not configured in .env. Outgoing emails will only be logged to console.',
      );
      return;
    }

    try {
      this.transporter = nodemailer.createTransport({
        host,
        port,
        secure,
        auth: {
          user,
          pass,
        },
      });
      this.logger.log(`Email transporter initialized successfully with ${host}:${port}`);
    } catch (err: any) {
      this.logger.error(`Failed to initialize email transporter: ${err.message}`);
    }
  }

  private getFromAddress(): string {
    return (
      this.configService.get<string>('EMAIL_FROM') ||
      process.env.EMAIL_FROM ||
      `"Kainos Store" <${this.configService.get<string>('SMTP_USER') || process.env.SMTP_USER || 'noreply@ecommerce.com'}>`
    );
  }

  async sendVerificationEmail(to: string, name: string, token: string): Promise<boolean> {
    const subject = 'Verify Your E-Commerce Account';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; }
          .container { max-width: 580px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #4f46e5, #7c3aed); color: #ffffff; padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
          .content { padding: 32px 24px; color: #374151; font-size: 16px; line-height: 1.6; }
          .code-box { background-color: #f3f4f6; border: 2px dashed #4f46e5; border-radius: 8px; text-align: center; padding: 20px; margin: 24px 0; }
          .code { font-family: monospace; font-size: 36px; font-weight: 700; color: #4f46e5; letter-spacing: 8px; margin: 0; }
          .footer { background-color: #f9fafb; padding: 20px 24px; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Welcome to Our Store!</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${name}</strong>,</p>
            <p>Thank you for creating an account. To complete your registration and activate your account, please use the 6-digit verification code below:</p>
            <div class="code-box">
              <div class="code">${token}</div>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This verification code will expire in <strong>24 hours</strong>.</p>
            <p>If you did not request this account, please disregard this email.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} E-Commerce API. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendMail({ to, subject, html, text: `Hello ${name}, your account verification code is: ${token}` });
  }

  async sendPasswordResetEmail(to: string, name: string, token: string): Promise<boolean> {
    const subject = 'Reset Your E-Commerce Password';
    const html = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="utf-8">
        <style>
          body { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Helvetica, Arial, sans-serif; background-color: #f4f6f8; margin: 0; padding: 0; }
          .container { max-width: 580px; margin: 40px auto; background-color: #ffffff; border-radius: 8px; overflow: hidden; box-shadow: 0 4px 6px rgba(0,0,0,0.05); }
          .header { background: linear-gradient(135deg, #ef4444, #dc2626); color: #ffffff; padding: 32px 24px; text-align: center; }
          .header h1 { margin: 0; font-size: 24px; font-weight: 700; letter-spacing: -0.5px; }
          .content { padding: 32px 24px; color: #374151; font-size: 16px; line-height: 1.6; }
          .code-box { background-color: #fef2f2; border: 2px dashed #ef4444; border-radius: 8px; text-align: center; padding: 20px; margin: 24px 0; }
          .code { font-family: monospace; font-size: 36px; font-weight: 700; color: #dc2626; letter-spacing: 8px; margin: 0; }
          .footer { background-color: #f9fafb; padding: 20px 24px; text-align: center; color: #6b7280; font-size: 13px; border-top: 1px solid #e5e7eb; }
        </style>
      </head>
      <body>
        <div class="container">
          <div class="header">
            <h1>Password Reset Request</h1>
          </div>
          <div class="content">
            <p>Hi <strong>${name}</strong>,</p>
            <p>We received a request to reset your password. Use the 6-digit code below to set a new password:</p>
            <div class="code-box">
              <div class="code">${token}</div>
            </div>
            <p style="color: #6b7280; font-size: 14px;">This code will expire in <strong>1 hour</strong>.</p>
            <p>If you did not request a password reset, you can safely ignore this email. Your password will remain unchanged.</p>
          </div>
          <div class="footer">
            <p>&copy; ${new Date().getFullYear()} E-Commerce API. All rights reserved.</p>
          </div>
        </div>
      </body>
      </html>
    `;

    return this.sendMail({ to, subject, html, text: `Hello ${name}, your password reset code is: ${token}` });
  }

  private async sendMail(options: {
    to: string;
    subject: string;
    html: string;
    text: string;
  }): Promise<boolean> {
    if (!this.transporter) {
      this.initTransporter();
    }

    if (!this.transporter) {
      this.logger.warn(
        `[MOCK EMAIL SENT] To: ${options.to} | Subject: ${options.subject}`,
      );
      this.logger.warn(`Content: ${options.text}`);
      return false;
    }

    try {
      const info = await this.transporter.sendMail({
        from: this.getFromAddress(),
        to: options.to,
        subject: options.subject,
        text: options.text,
        html: options.html,
      });

      this.logger.log(`Email successfully sent to ${options.to}. MessageId: ${info.messageId}`);
      return true;
    } catch (err: any) {
      this.logger.error(`Error sending email to ${options.to}: ${err.message}`);
      return false;
    }
  }
}
