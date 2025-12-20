require('dotenv').config({ path: '.env.local' });
const nodemailer = require('nodemailer');

(async () => {
  try {
    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    const receiver = process.env.CONTACT_RECEIVER || user;

    if (!user || !pass) {
      console.error('EMAIL_USER or EMAIL_PASS not set');
      process.exit(1);
    }

    const allowInsecure = process.env.SMTP_ALLOW_INSECURE === 'true';

    const transportOptions = {
      host: 'smtp.gmail.com',
      port: 465,
      secure: true,
      auth: { user, pass },
    };

    if (allowInsecure) transportOptions.tls = { rejectUnauthorized: false };

    const transporter = nodemailer.createTransport(transportOptions);

    const info = await transporter.sendMail({
      from: user,
      to: receiver,
      subject: 'Test message from dev script',
      text: 'This is a test',
    });

    console.log('Sent:', info);
  } catch (err) {
    console.error('Send error:', err);
    process.exit(1);
  }
})();
