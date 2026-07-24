const https = require('https');

exports.handler = async function(event) {
  const corsHeaders = {
    'Access-Control-Allow-Origin': '*',
    'Access-Control-Allow-Headers': 'Content-Type',
    'Access-Control-Allow-Methods': 'POST, OPTIONS',
    'Content-Type': 'application/json',
  };

  if (event.httpMethod === 'OPTIONS') {
    return { statusCode: 200, headers: corsHeaders, body: '' };
  }

  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, headers: corsHeaders, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey) {
    return { statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'ANTHROPIC_API_KEY not set in Netlify environment variables' }) };
  }

  let body;
  try { body = JSON.parse(event.body); }
  catch(e) { return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Invalid JSON body' }) }; }

  const { prompt } = body;
  if (!prompt) {
    return { statusCode: 400, headers: corsHeaders, body: JSON.stringify({ error: 'Missing prompt field' }) };
  }

  const payload = JSON.stringify({
    model: 'claude-sonnet-4-20250514',
    max_tokens: 1200,
    messages: [{ role: 'user', content: prompt }],
  });

  return new Promise((resolve) => {
    const options = {
      hostname: 'api.anthropic.com',
      path: '/v1/messages',
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'Content-Length': Buffer.byteLength(payload),
      },
    };

    const req = https.request(options, (res) => {
      let data = '';
      res.on('data', chunk => { data += chunk; });
      res.on('end', () => {
        try {
          const parsed = JSON.parse(data);
          if (res.statusCode !== 200) {
            resolve({ statusCode: res.statusCode, headers: corsHeaders, body: JSON.stringify({ error: parsed.error?.message || 'API error' }) });
            return;
          }
          const text = (parsed.content || []).map(c => c.text || '').join('\n');
          resolve({ statusCode: 200, headers: corsHeaders, body: JSON.stringify({ text }) });
        } catch(e) {
          resolve({ statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: 'Failed to parse response' }) });
        }
      });
    });

    req.on('error', (e) => {
      resolve({ statusCode: 500, headers: corsHeaders, body: JSON.stringify({ error: e.message }) });
    });

    req.write(payload);
    req.end();
  });
};
