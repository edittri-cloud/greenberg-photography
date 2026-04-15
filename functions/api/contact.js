// functions/api/contact.js
import { EmailMessage } from "cloudflare:email";

export async function onRequestPost(context) {
  const { env, request } = context;
  const headers = { 'Content-Type': 'application/json' };

  // Debug logging
  console.log('CONTACT_EMAIL binding:', !!env.CONTACT_EMAIL);

  if (!env.CONTACT_EMAIL) {
    return new Response(JSON.stringify({ error: 'Email binding not configured. Check wrangler.toml [[send_email]] section.' }), { status: 500, headers });
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

    const bodyLines = [
      `Name: ${name}`,
      `Email: ${email}`,
    ];
    if (image) bodyLines.push(`Image: ${image}`);
    bodyLines.push('', 'Message:', message);

    const raw = [
      'MIME-Version: 1.0',
      'From: Portfolio Contact <contact@marcgreenbergphoto.com>',
      'To: marcgreenbergphoto@gmail.com',
      `Subject: ${subject}`,
      'Content-Type: text/plain; charset=utf-8',
      '',
      ...bodyLines,
    ].join('\r\n');

    console.log('Creating EmailMessage...');
    const msg = new EmailMessage(
      'contact@marcgreenbergphoto.com',
      'marcgreenbergphoto@gmail.com',
      raw
    );

    console.log('Sending...');
    await env.CONTACT_EMAIL.send(msg);
    console.log('Sent OK');

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });

  } catch (err) {
    console.error('Error:', err.message);
    // Return the actual error so we can debug it
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
