const fs = require('fs');
const path = require('path');

module.exports = (req, res) => {
  const supabaseUrl = process.env.SUPABASE_URL;
  const supabaseAnonKey = process.env.SUPABASE_ANON_KEY;

  if (!supabaseUrl || !supabaseAnonKey) {
    res.status(500).send('<h1>Configuration Error</h1><p>Server environment variables are not set. Please contact support.</p>');
    return;
  }

  let html = fs.readFileSync(
    path.join(process.cwd(), 'personalization-flow.html'),
    'utf8'
  );

  html = html
    .replace('{{SUPABASE_URL}}', supabaseUrl)
    .replace('{{SUPABASE_ANON_KEY}}', supabaseAnonKey);

  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.send(html);
};
