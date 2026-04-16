// functions/api/contact.js
// Proxies contact form to Formspree

export async function onRequestPost(context) {
  const { request } = context;
  const headers = { 'Content-Type': 'application/json' };

  try {
    const formData = await request.formData();

    const res = await fetch('https://formspree.io/f/mnjljrnv', {
      method: 'POST',
      headers: { 'Accept': 'application/json' },
      body: formData,
    });

    const data = await res.json();

    if (res.ok) {
      return new Response(JSON.stringify({ ok: true }), { status: 200, headers });
    } else {
      return new Response(JSON.stringify({ error: data.error || 'Formspree rejected the submission.' }), { status: 400, headers });
    }

  } catch (err) {
    console.error('Contact error:', err.message);
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
