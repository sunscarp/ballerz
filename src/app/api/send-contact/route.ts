import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { name, subject, email, message } = body || {};

    if (!name || !subject || !email || !message) {
      return NextResponse.json({ error: "Missing fields" }, { status: 400 });
    }

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const receiver = process.env.CONTACT_RECEIVER || user;

    if (!user || !pass) {
      return NextResponse.json({ error: "Email not configured" }, { status: 500 });
    }

    const allowInsecure = process.env.SMTP_ALLOW_INSECURE === "true";

    const transportOptions: any = {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        user,
        pass,
      },
    };

    if (allowInsecure) {
      transportOptions.tls = { rejectUnauthorized: false };
    }

    const transporter = nodemailer.createTransport(transportOptions);

    const senderName = process.env.SENDER_NAME || "Ballerz Contact";

    const mail = {
      from: `${senderName} <${user}>`,
      to: receiver,
      replyTo: email,
      subject: `Contact form: ${subject}`,
      text: `Name: ${name}\nEmail: ${email}\n\n${message}`,
      html: `<p><strong>Name:</strong> ${escapeHtml(name)}</p>
             <p><strong>Email:</strong> ${escapeHtml(email)}</p>
             <p><strong>Message:</strong></p>
             <p>${escapeHtml(message).replace(/\n/g, '<br/>')}</p>`,
    };

    await transporter.sendMail(mail);

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error('send-contact error:', err);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}

function escapeHtml(str: string) {
  return String(str)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}
