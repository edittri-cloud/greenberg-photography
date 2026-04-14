// functions/api/contact.js
// Handles contact form submissions via Cloudflare Email Routing
// No external dependencies — builds MIME email manually

import { EmailMessage } from "cloudflare:email";

export async function onRequestPost(context) {
  const { env, request } = context;

  const headers = { 'Content-Type': 'application/json' };

  if (!env.CONTACT_EMAIL) {
    return new Response(JSON.stringify({ error: 'Email binding not configured.' }), { status: 500, headers });
  }

  try {
    const formData = await request.formData();
    const name    = (formData.get('name')    || '').trim();
    const email   = (formData.get('email')   || '').trim();
    const image   = (formData.get('image')   || '').trim();
    const message = (formData.get('message') || '').trim();

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), { status: 400, headers });
    }

    const subject = image
      ? `Portfolio enquiry about: ${image}`
      : `New portfolio contact from ${name}`;

    const body = [
      `Name: ${name}`,
      `Email: ${email}`,
      image ? `Image: ${image}` : null,
      ``,
      `Message:`,
      message,
    ].filter(line => line !== null).join('\r\n');

    // Build a minimal valid MIME message with no external libraries
    const raw = [
      `MIME-Version: 1.0`,
      `From: Portfolio Contact <contact@marcgreenbergphoto.com>`,
      `To: ${env.CONTACT_EMAIL.destination}`,
      `Subject: ${subject}`,
      `Content-Type: text/plain; charset=utf-8`,
      ``,
      body,
    ].join('\r\n');

    const msg = new EmailMessage(
      'contact@marcgreenbergphoto.com',
      env.CONTACT_EMAIL.destination,
      raw
    );

    await env.CONTACT_EMAIL.send(msg);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });

  } catch (err) {
    console.error('Contact form error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
