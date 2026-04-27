import nodemailer from "nodemailer";
const smtpHost = process.env.SMTP_HOST || "smtp.gmail.com";
const smtpPort = Number(process.env.SMTP_PORT || 587);
const smtpUser = process.env.GMAIL_USER;
const smtpPass = process.env.GMAIL_APP_PASSWORD;
export const sendResetPasswordEmail = async (email, name, resetLink) => {
    if (!smtpUser || !smtpPass) {
        throw new Error("Missing GMAIL_USER or GMAIL_APP_PASSWORD in environment");
    }
    const transporter = nodemailer.createTransport({
        host: smtpHost,
        port: smtpPort,
        secure: false,
        auth: {
            user: smtpUser,
            pass: smtpPass,
        },
    });
    await transporter.sendMail({
        from: process.env.FROM_EMAIL || smtpUser,
        to: email,
        subject: "Reset your password",
        html: `
            <div style="font-family:Arial,sans-serif;line-height:1.6;color:#111">
                <h2>Password Reset Request</h2>
                <p>Hi ${name},</p>
                <p>We received a request to reset your password. Click the button below to set a new password.</p>
                <p>
                    <a href="${resetLink}" style="display:inline-block;background:#0b57d0;color:#fff;padding:10px 14px;text-decoration:none;border-radius:6px;">
                        Reset Password
                    </a>
                </p>
                <p>This link will expire in 5 minutes.</p>
                <p>If you did not request this, you can safely ignore this email.</p>
            </div>
        `,
    });
};
