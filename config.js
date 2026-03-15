// ============================================================
//  PHOTOGRAPHY PORTFOLIO — CONFIGURATION
//  Edit this file to connect your Cloudflare R2 bucket.
// ============================================================

window.PORTFOLIO_CONFIG = {

  // Your R2 public bucket URL (no trailing slash)
  // Example: "https://pub-6c92cdd67a854ed7aef02bdc1aa2fd14.r2.dev"
  // Leave as empty string "" until you've set up R2
  R2_BUCKET_URL: "https://pub-6c92cdd67a854ed7aef02bdc1aa2fd14.r2.dev",

  // ---- Optional Settings ----

  // Your name (shown in footer + page title)
  PHOTOGRAPHER_NAME: "Greenberg Photography",

  // Subtitle shown in footer
  SUBTITLE: "Photography Portfolio",

  // Hero text customisation
  HERO_EYEBROW: "Visual storytelling",
  HERO_TITLE_LINE1: "Light &",
  HERO_TITLE_LINE2: "Shadow",
  HERO_DESC: "A collection of moments captured in time — where composition meets emotion and the ordinary becomes extraordinary.",

  // Supported image file extensions (lowercase)
  SUPPORTED_EXTENSIONS: ["jpg", "jpeg", "png", "webp", "avif"],

  // Number of columns in the masonry grid (desktop)
  // Options: 2, 3, 4
  GRID_COLUMNS: 3,

};
