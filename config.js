// ============================================================
//  PHOTOGRAPHY PORTFOLIO — CONFIGURATION
//  Edit this file to connect your Cloudflare R2 bucket.
// ============================================================

window.PORTFOLIO_CONFIG = {

  // Your R2 public bucket URL (no trailing slash)
  // Example: "https://pub-abc123.r2.dev" or "https://photos.yourdomain.com"
  // Leave as empty string "" until you've set up R2
  R2_BUCKET_URL: "https://images.marcgreenbergphoto.com",

  // Hero slideshow folder — the name of the R2 folder containing your hero photos
  // Create a folder in R2 (e.g. "hero"), upload your best 10 shots into it,
  // and they will cycle automatically with a Ken Burns effect.
  HERO_FOLDER: "hero",

  // ---- Optional Settings ----

  // Your name (shown in footer + page title)
  PHOTOGRAPHER_NAME: "Marc Greenberg Photo",

  // Subtitle shown in footer
  SUBTITLE: "Photography Portfolio",

  // Hero text customisation
  HERO_EYEBROW: "Energetic Images",
  HERO_TITLE_LINE1: "Surprising &",
  HERO_TITLE_LINE2: "Energetic",
  HERO_DESC: "glimpses at a fascinating world. Visual stories that capture attention and imagination.",

  // Supported image file extensions (lowercase)
  SUPPORTED_EXTENSIONS: ["jpg", "jpeg", "png", "webp", "avif"],

  // Number of columns in the masonry grid (desktop)
  // Options: 2, 3, 4
  GRID_COLUMNS: 3,

};
