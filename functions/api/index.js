// functions/api/photos.js
// Cloudflare Pages Function — proxies R2 bucket listing
// This avoids CORS issues when listing bucket contents.
// Deploy this alongside your site on Cloudflare Pages.

export async function onRequest(context) {
  const { env } = context;

  // R2 bucket must be bound in your Cloudflare Pages settings
  // Binding name: PHOTOS_BUCKET
  if (!env.PHOTOS_BUCKET) {
    return new Response(JSON.stringify({ error: 'R2 bucket not bound. See SETUP.md.' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }

  try {
    const listed = await env.PHOTOS_BUCKET.list({ limit: 1000 });

    const imageExtensions = ['jpg', 'jpeg', 'png', 'webp', 'avif'];
    const photos = listed.objects
      .map(obj => obj.key)
      .filter(key => {
        const ext = key.split('.').pop().toLowerCase();
        return imageExtensions.includes(ext) && !key.startsWith('.');
      })
      .sort();

    return new Response(JSON.stringify({ photos }), {
      headers: {
        'Content-Type': 'application/json',
        'Cache-Control': 'public, max-age=60'
      }
    });
  } catch (err) {
    return new Response(JSON.stringify({ error: err.message }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' }
    });
  }
}
