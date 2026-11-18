/* =====================================================================
   CONTACT SERVER
   Receives the contact form from the portfolio site, saves each
   message into messages.json (in this same folder) and emails it to you.

   Start it with:   npm start
   ===================================================================== */

const express = require('express'); // the web server framework
const cors = require('cors');       // lets the website (a different address) talk to this server
const fs = require('fs');           // built into Node: read and write files
const path = require('path');       // built into Node: build file paths safely

const app = express();
const PORT = process.env.PORT || 3000;
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

/* Email settings. These are read from environment variables so that the
   secret key and your address are never written in the code.
   Set them on Render under: your service -> Environment. */
const RESEND_API_KEY = process.env.RESEND_API_KEY;
// .trim() removes any space or line break pasted in by accident on Render
const CONTACT_TO_EMAIL = (process.env.CONTACT_TO_EMAIL || '').trim();
// The "from" address: Resend's test address, which works without owning a domain.
// With it, Resend only delivers to the email address your Resend account was created with.
const CONTACT_FROM_EMAIL = 'onboarding@resend.dev';

/* Only these addresses are allowed to send the form to this server.
   'null' is what a browser sends when index.html is opened by double-clicking it. */
const ALLOWED_ORIGINS = [
  'https://rishabh-tiwari-labs.github.io',
  'http://localhost:5500',
  'http://127.0.0.1:5500',
  'null'
];

app.use(cors({ origin: ALLOWED_ORIGINS }));
app.use(express.json({ limit: '20kb' })); // understand JSON request bodies (and refuse huge ones)

/* Read every saved message. Returns an empty list if the file doesn't exist yet. */
function readMessages() {
  if (!fs.existsSync(MESSAGES_FILE)) return [];
  const text = fs.readFileSync(MESSAGES_FILE, 'utf8');
  return text.trim() ? JSON.parse(text) : [];
}

/* Add one message to messages.json. */
function saveMessage(entry) {
  const messages = readMessages();
  messages.push(entry);
  fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
}

/* Email one message to you through the Resend API (a normal HTTPS request, not SMTP).
   Throws an error if Resend refuses the request or cannot be reached. */
async function sendEmail(entry) {
  // Shown in the Render logs so you can check where the email is going
  console.log('Sending email to: ' + CONTACT_TO_EMAIL);

  const response = await fetch('https://api.resend.com/emails', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + RESEND_API_KEY,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      from: CONTACT_FROM_EMAIL,
      to: [CONTACT_TO_EMAIL],
      reply_to: entry.email, // the visitor's address goes ONLY here, so "Reply" answers them
      subject: 'Portfolio message from ' + entry.name.replace(/\s+/g, ' '),
      text: entry.message + '\n\nFrom: ' + entry.name + ' (' + entry.email + ')'
    }),
    signal: AbortSignal.timeout(10000) // give up after 10 seconds
  });

  if (!response.ok) {
    throw new Error('Resend answered ' + response.status + ': ' + (await response.text()));
  }
}

/* Tidy up one field: make sure it is text and remove spaces at the ends. */
function clean(value) {
  return typeof value === 'string' ? value.trim() : '';
}

/* ---------------------------------------------------------------------
   GET /   A quick check that the server is running (open it in a browser)
   --------------------------------------------------------------------- */
app.get('/', function (req, res) {
  res.send('Contact server is running.');
});

/* ---------------------------------------------------------------------
   POST /contact   Save one message
   Expects JSON like: { "name": "...", "email": "...", "message": "..." }
   --------------------------------------------------------------------- */
app.post('/contact', async function (req, res) {
  const body = req.body || {};
  const name = clean(body.name);
  const email = clean(body.email);
  const message = clean(body.message);

  // 1. Check the input
  if (!name || !email || !message) {
    return res.status(400).json({ ok: false, error: 'Name, email and message are all required.' });
  }
  if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
    return res.status(400).json({ ok: false, error: 'Please enter a valid email address.' });
  }
  if (name.length > 100 || email.length > 200 || message.length > 5000) {
    return res.status(400).json({ ok: false, error: 'One of the fields is too long.' });
  }

  const entry = {
    id: Date.now(),
    name: name,
    email: email,
    message: message,
    receivedAt: new Date().toISOString()
  };
  console.log('New message from ' + name.replace(/\s+/g, ' '));

  // 2. Save the message to the file
  let saved = false;
  try {
    saveMessage(entry);
    saved = true;
  } catch (err) {
    console.error('Could not save message:', err.message);
  }

  // 3. Email the message to you
  let emailed = false;
  if (RESEND_API_KEY && CONTACT_TO_EMAIL) {
    try {
      await sendEmail(entry);
      emailed = true;
    } catch (err) {
      console.error('Could not send email:', err.message);
    }
  }

  // 4. Tell the website how it went. It only counts as failed if the
  //    message was neither saved nor emailed, because then it would be lost.
  if (!saved && !emailed) {
    return res.status(500).json({ ok: false, error: 'Could not deliver your message. Please try again.' });
  }
  res.status(201).json({ ok: true });
});

/* If the request body is not valid JSON, answer with a clear error instead of crashing. */
app.use(function (err, req, res, next) {
  res.status(400).json({ ok: false, error: 'The request could not be read.' });
});

app.listen(PORT, function () {
  console.log('Contact server running at http://localhost:' + PORT);
  if (!RESEND_API_KEY || !CONTACT_TO_EMAIL) {
    console.warn('Email is OFF: set RESEND_API_KEY and CONTACT_TO_EMAIL to turn it on. Messages are still saved to the file.');
  }
});
