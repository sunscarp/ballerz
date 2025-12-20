import PDFDocument from "pdfkit";
import nodemailer from "nodemailer";
import { NextResponse } from "next/server";

function generatePdfBuffer(order: any) {
  return new Promise<Buffer>((resolve, reject) => {
    try {
      const doc = new PDFDocument({ size: "A4", margin: 40 });
      const chunks: Uint8Array[] = [];

      doc.on("data", (chunk) => chunks.push(chunk));
      doc.on("end", () => resolve(Buffer.concat(chunks)));

      doc.fontSize(18).text("Ballerz Invoice", { align: "left" });
      doc.moveDown();

      doc.fontSize(10).text(`Order ID: ${order.orderId || order.id}`);
      if (order.createdAt) doc.text(`Order Date: ${order.createdAt}`);
      doc.text(`Status: ${order.status || "completed"}`);
      doc.moveDown();

      doc.fontSize(12).text("Customer Details");
      doc.fontSize(10).text(`Name: ${order.customer?.name || "-"}`);
      doc.text(`Email: ${order.customer?.email || "-"}`);
      doc.text(`Phone: ${order.customer?.phone || "-"}`);
      doc.text(`Address: ${order.customer?.address || "-"}`);
      doc.moveDown();

      doc.fontSize(11).text("Items:");
      doc.moveDown(0.5);

      const tableTop = doc.y;
      const itemX = 40;
      const qtyX = 320;
      const priceX = 380;
      const totalX = 460;

      doc.fontSize(10).text("Product", itemX, tableTop);
      doc.text("Qty", qtyX, tableTop);
      doc.text("Price", priceX, tableTop);
      doc.text("Total", totalX, tableTop);

      let y = tableTop + 20;
      (order.items || []).forEach((it: any) => {
        const name = it.product?.Description || it.product?.Product || "Item";
        const qty = Number(it.Quantity || 1);
        const price = Number(it.product?.Price || 0);
        const lineTotal = price * qty;

        doc.text(String(name), itemX, y, { width: 260 });
        doc.text(String(qty), qtyX, y);
        doc.text(`Rs. ${price}`, priceX, y);
        doc.text(`Rs. ${lineTotal}`, totalX, y);

        y += 18;
      });

      doc.moveDown(2);
      doc.fontSize(12).text(`Grand Total: Rs. ${order.total || 0}`, { align: "right" });

      doc.moveDown(2);
      doc.fontSize(10).text("Thank you for shopping with Ballerz.");

      doc.end();
    } catch (err) {
      reject(err);
    }
  });
}

export async function POST(req: Request) {
  try {
    const body = await req.json();
    const { order, orderId, sendTo } = body || {};

    const recipient = sendTo || order?.customer?.email;
    if (!recipient) return NextResponse.json({ error: "No recipient" }, { status: 400 });

    const user = process.env.EMAIL_USER;
    const pass = process.env.EMAIL_PASS;
    if (!user || !pass) return NextResponse.json({ error: "Email not configured" }, { status: 500 });

    const allowInsecure = process.env.SMTP_ALLOW_INSECURE === "true";
    const transportOptions: any = {
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: { user, pass },
    };
    if (allowInsecure) transportOptions.tls = { rejectUnauthorized: false };

    const transporter = nodemailer.createTransport(transportOptions);

    const data = { ...order, orderId };
    const pdfBuffer = await generatePdfBuffer(data);

    const senderName = process.env.SENDER_NAME || "Ballerz";

    await transporter.sendMail({
      from: `${senderName} <${user}>`,
      to: recipient,
      subject: `Your Ballerz Order ${orderId || order?.id}`,
      text: `Thank you for your order. Attached is your invoice.`,
      attachments: [
        { filename: `Ballerz_Order_${orderId || order?.id}.pdf`, content: pdfBuffer },
      ],
    });

    return NextResponse.json({ ok: true });
  } catch (err: any) {
    console.error("send-invoice error:", err);
    return NextResponse.json({ error: err?.message || "Failed" }, { status: 500 });
  }
}
