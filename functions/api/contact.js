// functions/api/contact.js
// Handles contact form submissions and sends email via Cloudflare Email Routing

import { EmailMessage } from "cloudflare:email";
//import { createMimeMessage } from "mimetext";

export async function onRequestPost(context) {
  const { env, request } = context;

  // CORS headers
  const headers = {
    'Content-Type': 'application/json',
    'Access-Control-Allow-Origin': '*',
  };

  if (!env.CONTACT_EMAIL) {
    return new Response(JSON.stringify({ error: 'Email not configured.' }), { status: 500, headers });
  }

  try {
    const formData = await request.formData();
    const name    = (formData.get('name') || '').trim();
    const email   = (formData.get('email') || '').trim();
    const image   = (formData.get('image') || '').trim();
    const message = (formData.get('message') || '').trim();

    if (!name || !email || !message) {
      return new Response(JSON.stringify({ error: 'Missing required fields.' }), { status: 400, headers });
    }

    // Build email
    const msg = createMimeMessage();
    msg.setSender({ name: 'Portfolio Contact Form', addr: 'contact@marcgreenbergphoto.com' });
    msg.setRecipient(env.CONTACT_EMAIL.destination);
    msg.setSubject(image ? `Enquiry about: ${image}` : `New contact from ${name}`);
    msg.addMessage({
      contentType: 'text/plain',
      data: [
        `Name: ${name}`,
        `Email: ${email}`,
        image ? `Image: ${image}` : '',
        '',
        `Message:`,
        message,
      ].filter(Boolean).join('\n'),
    });

    const emailMsg = new EmailMessage(
      'contact@marcgreenbergphoto.com',
      env.CONTACT_EMAIL.destination,
      msg.asRaw()
    );

    await env.CONTACT_EMAIL.send(emailMsg);

    return new Response(JSON.stringify({ ok: true }), { status: 200, headers });

  } catch (err) {
    console.error('Contact form error:', err);
    return new Response(JSON.stringify({ error: err.message }), { status: 500, headers });
  }
}

// Handle OPTIONS preflight
export async function onRequestOptions() {
  return new Response(null, {
    headers: {
      'Access-Control-Allow-Origin': '*',
      'Access-Control-Allow-Methods': 'POST, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type',
    }
  });
}
