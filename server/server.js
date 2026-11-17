/* =====================================================================
   CONTACT SERVER
   Receives the contact form from the portfolio site and saves each
   message into messages.json (in this same folder).

   Start it with:   npm start
   ===================================================================== */

const express = require('express'); // the web server framework
const cors = require('cors');       // lets the website (a different address) talk to this server
const fs = require('fs');           // built into Node: read and write files
const path = require('path');       // built into Node: build file paths safely

const app = express();
const PORT = process.env.PORT || 3000;
const MESSAGES_FILE = path.join(__dirname, 'messages.json');

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
app.post('/contact', function (req, res) {
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

  // 2. Add the new message to the list and save the whole list back to the file
  try {
    const messages = readMessages();
    messages.push({
      id: Date.now(),
      name: name,
      email: email,
      message: message,
      receivedAt: new Date().toISOString()
    });
    fs.writeFileSync(MESSAGES_FILE, JSON.stringify(messages, null, 2));
  } catch (err) {
    console.error('Could not save message:', err);
    return res.status(500).json({ ok: false, error: 'Could not save your message. Please try again.' });
  }

  // 3. Tell the website it worked
  console.log('New message from ' + name + ' <' + email + '>');
  res.status(201).json({ ok: true });
});

/* If the request body is not valid JSON, answer with a clear error instead of crashing. */
app.use(function (err, req, res, next) {
  res.status(400).json({ ok: false, error: 'The request could not be read.' });
});

app.listen(PORT, function () {
  console.log('Contact server running at http://localhost:' + PORT);
});
