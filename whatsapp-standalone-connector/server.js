/**
 * server.js
 * 
 * Standalone REST API Server & Web UI for WhatsApp Connection & Messaging
 */

const express = require('express');
const cors = require('cors');
const path = require('path');
const waService = require('./whatsappService');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve frontend test UI
app.use(express.static(path.join(__dirname, 'public')));

// 1. Check Status
app.get('/api/status', (req, res) => {
  const sessionId = req.query.sessionId || 'default';
  const status = waService.getStatus(sessionId);
  const user = waService.getUser(sessionId);
  const phone = user ? (user.id || '').split(':')[0].split('@')[0] : null;
  res.json({ sessionId, status, phone, user });
});

// 2. List all active sessions
app.get('/api/sessions', (req, res) => {
  res.json({ sessions: waService.getAllSessions() });
});

// 3. Start Connection / Request QR Code
app.post('/api/connect', async (req, res) => {
  const sessionId = req.body.sessionId || 'default';
  try {
    waService.startSession(sessionId).catch(err => {
      console.error(`[Connect Error ${sessionId}]`, err.message);
    });
    res.json({
      ok: true,
      sessionId,
      message: 'Session initiated. Connect to /api/qr-stream to receive the QR code.',
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// 4. Real-time QR Code & Status Stream (SSE)
app.get('/api/qr-stream', (req, res) => {
  const sessionId = req.query.sessionId || 'default';

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders();

  // Send initial state immediately
  const qr = waService.getQrCode(sessionId);
  if (qr) {
    res.write(`data: ${JSON.stringify({ type: 'qr', qr })}\n\n`);
  }

  const initialStatus = waService.getStatus(sessionId);
  const initialUser = waService.getUser(sessionId);
  const initialPhone = initialUser ? (initialUser.id || '').split(':')[0].split('@')[0] : null;
  res.write(`data: ${JSON.stringify({ type: 'status', status: initialStatus, phone: initialPhone })}\n\n`);

  // Event handlers
  const onQr = (data) => {
    if (data.sessionId === sessionId) {
      res.write(`data: ${JSON.stringify({ type: 'qr', qr: data.qrDataUrl })}\n\n`);
    }
  };

  const onStatus = (data) => {
    if (data.sessionId === sessionId) {
      res.write(`data: ${JSON.stringify({ type: 'status', status: data.status, phone: data.phone })}\n\n`);
    }
  };

  waService.on('qr', onQr);
  waService.on('status', onStatus);

  req.on('close', () => {
    waService.off('qr', onQr);
    waService.off('status', onStatus);
  });
});

// 5. Send WhatsApp Message (Directly without opening WhatsApp)
app.post('/api/send', async (req, res) => {
  const { sessionId = 'default', to, text } = req.body;
  if (!to) {
    return res.status(400).json({ error: 'Field "to" (phone number) is required.' });
  }
  if (!text) {
    return res.status(400).json({ error: 'Field "text" (message) is required.' });
  }

  try {
    const result = await waService.sendMessage(sessionId, to, text);
    res.json({ ok: true, result });
  } catch (err) {
    res.status(400).json({ ok: false, error: err.message });
  }
});

// 6. Disconnect
app.post('/api/disconnect', async (req, res) => {
  const sessionId = req.body.sessionId || 'default';
  try {
    const result = await waService.disconnectSession(sessionId);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
  console.log(`\n======================================================`);
  console.log(`🚀 WhatsApp Standalone Connector is running!`);
  console.log(`👉 Open Web UI: http://localhost:${PORT}`);
  console.log(`👉 Direct Send API: POST http://localhost:${PORT}/api/send`);
  console.log(`======================================================\n`);
});
