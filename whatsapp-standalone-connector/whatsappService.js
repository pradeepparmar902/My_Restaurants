/**
 * whatsappService.js
 * 
 * Standalone WhatsApp Connection & Messaging Service
 * Powered by Baileys (@whiskeysockets/baileys)
 * 
 * Allows connecting WhatsApp via QR code and sending messages directly
 * without needing the WhatsApp mobile app or desktop open.
 */

const {
  makeWASocket,
  useMultiFileAuthState,
  DisconnectReason,
  fetchLatestBaileysVersion,
  makeCacheableSignalKeyStore,
} = require('@whiskeysockets/baileys');
const qrcode = require('qrcode');
const path = require('path');
const fs = require('fs');
const EventEmitter = require('events');
const pino = require('pino');

class WhatsAppService extends EventEmitter {
  constructor(options = {}) {
    super();
    this.sessionsDir = options.sessionsDir || path.join(__dirname, 'sessions');
    if (!fs.existsSync(this.sessionsDir)) {
      fs.mkdirSync(this.sessionsDir, { recursive: true });
    }
    this.sessions = new Map();
  }

  /**
   * Format any phone number into a valid WhatsApp JID
   * e.g., "+91 98199 84437" -> "919819984437@s.whatsapp.net"
   */
  formatJid(to) {
    if (!to) throw new Error('Recipient number is required');
    let cleaned = String(to).trim();
    // If already has suffix, return as is
    if (cleaned.endsWith('@s.whatsapp.net') || cleaned.endsWith('@g.us')) {
      return cleaned;
    }
    // Remove all non-digits
    cleaned = cleaned.replace(/[^0-9]/g, '');
    return `${cleaned}@s.whatsapp.net`;
  }

  /**
   * Get current session info
   */
  getSession(sessionId = 'default') {
    return this.sessions.get(sessionId) || null;
  }

  getStatus(sessionId = 'default') {
    const s = this.sessions.get(sessionId);
    return s ? s.status : 'disconnected';
  }

  getUser(sessionId = 'default') {
    const s = this.sessions.get(sessionId);
    return s && s.sock && s.sock.user ? s.sock.user : null;
  }

  getQrCode(sessionId = 'default') {
    const s = this.sessions.get(sessionId);
    return s ? s.qrDataUrl : null;
  }

  getAllSessions() {
    const list = [];
    for (const [id, s] of this.sessions.entries()) {
      const user = s.sock?.user || null;
      const phone = user ? (user.id || '').split(':')[0].split('@')[0] : null;
      list.push({
        sessionId: id,
        status: s.status,
        phone,
        user,
      });
    }
    return list;
  }

  /**
   * Start or resume a WhatsApp session
   */
  async startSession(sessionId = 'default') {
    const existing = this.sessions.get(sessionId);
    // Keep existing session if it is actively connected, negotiating, or showing a QR code
    if (existing && (existing.status === 'connected' || existing.status === 'connecting' || existing.status === 'qr')) {
      return existing;
    }

    if (existing?.reconnectTimer) {
      clearTimeout(existing.reconnectTimer);
      existing.reconnectTimer = null;
    }

    if (existing?.sock) {
      try {
        existing.sock.ev.removeAllListeners('connection.update');
        existing.sock.end();
      } catch (e) {}
    }

    const session = {
      sessionId,
      sock: null,
      status: 'connecting',
      qrDataUrl: null,
      reconnectAttempts: 0,
      reconnectTimer: null,
    };
    this.sessions.set(sessionId, session);
    this.emit('status', { sessionId, status: 'connecting' });

    const sessionFolder = path.join(this.sessionsDir, sessionId);
    const { state, saveCreds } = await useMultiFileAuthState(sessionFolder);
    const { version } = await fetchLatestBaileysVersion();

    const sock = makeWASocket({
      version,
      auth: {
        creds: state.creds,
        keys: makeCacheableSignalKeyStore(state.keys, pino({ level: 'silent' })),
      },
      printQRInTerminal: false,
      logger: pino({ level: 'silent' }),
      browser: ['WhatsApp Direct Connect', 'Chrome', '11.0'],
      syncFullHistory: false,
      markOnlineOnConnect: false,
    });

    session.sock = sock;

    // Save auth credentials
    sock.ev.on('creds.update', saveCreds);

    // Listen to connection updates
    sock.ev.on('connection.update', async (update) => {
      const { connection, lastDisconnect, qr } = update;

      // New QR Code generated
      if (qr) {
        try {
          const dataUrl = await qrcode.toDataURL(qr);
          session.status = 'qr';
          session.qrDataUrl = dataUrl;
          this.emit('qr', { sessionId, qrDataUrl: dataUrl, rawQr: qr });
          this.emit('status', { sessionId, status: 'qr' });
        } catch (err) {
          console.error(`[WhatsApp ${sessionId}] Error generating QR code:`, err);
        }
      }

      // Connection opened successfully
      if (connection === 'open') {
        session.status = 'connected';
        session.qrDataUrl = null;
        session.reconnectAttempts = 0;
        const user = sock.user;
        const phone = user ? (user.id || '').split(':')[0].split('@')[0] : 'unknown';
        console.log(`[WhatsApp ${sessionId}] Connected! Phone: ${phone}`);
        this.emit('status', { sessionId, status: 'connected', user, phone });
      }

      // Connection closed
      if (connection === 'close') {
        const statusCode = lastDisconnect?.error?.output?.statusCode;
        const shouldReconnect = statusCode !== DisconnectReason.loggedOut;
        session.status = 'disconnected';
        session.qrDataUrl = null;

        console.log(`[WhatsApp ${sessionId}] Connection closed (code: ${statusCode}). Reconnect: ${shouldReconnect}`);
        this.emit('status', { sessionId, status: 'disconnected', code: statusCode });

        if (session.reconnectTimer) {
          clearTimeout(session.reconnectTimer);
          session.reconnectTimer = null;
        }

        if (shouldReconnect) {
          // Reconnect automatically with a stable 5s backoff
          session.reconnectTimer = setTimeout(() => {
            session.reconnectTimer = null;
            this.startSession(sessionId).catch(err => {
              console.error(`[WhatsApp ${sessionId}] Reconnect failed:`, err.message);
            });
          }, 5000);
        } else {
          // Logged out: clean up session folder
          this.sessions.delete(sessionId);
          try {
            fs.rmSync(sessionFolder, { recursive: true, force: true });
          } catch (e) {}
        }
      }
    });

    // Listen to incoming messages
    sock.ev.on('messages.upsert', ({ messages, type }) => {
      for (const m of messages) {
        if (!m.message || m.key.fromMe) continue;
        const sender = m.key.remoteJid;
        const body = m.message.conversation 
          || m.message.extendedTextMessage?.text 
          || m.message.imageMessage?.caption 
          || '';
        this.emit('message', {
          sessionId,
          sender,
          body,
          rawMessage: m,
          timestamp: m.messageTimestamp,
        });
      }
    });

    return session;
  }

  /**
   * Send a direct text message
   * @param {string} sessionId Session identifier (default 'default')
   * @param {string} to Recipient phone number or JID (e.g. "919876543210")
   * @param {string} text Message body
   */
  async sendMessage(sessionId = 'default', to, text) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected' || !session.sock) {
      throw new Error(`WhatsApp is not connected for session "${sessionId}". Please scan the QR code first.`);
    }
    if (!text || String(text).trim() === '') {
      throw new Error('Message text cannot be empty.');
    }

    const jid = this.formatJid(to);
    console.log(`[WhatsApp ${sessionId}] Sending message to ${jid}`);
    const result = await session.sock.sendMessage(jid, { text: String(text) });
    return {
      ok: true,
      to: jid,
      messageId: result?.key?.id,
      timestamp: result?.messageTimestamp,
    };
  }

  /**
   * Send an image, document, or audio
   * @param {string} sessionId
   * @param {string} to
   * @param {object} media { image: Buffer|{url}, caption, document: Buffer|{url}, fileName, mimetype }
   */
  async sendMedia(sessionId = 'default', to, media) {
    const session = this.sessions.get(sessionId);
    if (!session || session.status !== 'connected' || !session.sock) {
      throw new Error(`WhatsApp is not connected for session "${sessionId}".`);
    }
    const jid = this.formatJid(to);
    const result = await session.sock.sendMessage(jid, media);
    return {
      ok: true,
      to: jid,
      messageId: result?.key?.id,
    };
  }

  /**
   * Disconnect and logout
   */
  async disconnectSession(sessionId = 'default') {
    const session = this.sessions.get(sessionId);
    if (session) {
      if (session.reconnectTimer) {
        clearTimeout(session.reconnectTimer);
        session.reconnectTimer = null;
      }
      if (session.sock) {
        try { session.sock.ev.removeAllListeners('connection.update'); } catch (e) {}
        try { await session.sock.logout(); } catch (e) {}
        try { session.sock.end(); } catch (e) {}
      }
      this.sessions.delete(sessionId);
    }
    const sessionFolder = path.join(this.sessionsDir, sessionId);
    try {
      fs.rmSync(sessionFolder, { recursive: true, force: true });
    } catch (e) {}
    this.emit('status', { sessionId, status: 'disconnected' });
    return { ok: true, sessionId };
  }
}

// Export a singleton instance and the class
const defaultService = new WhatsAppService();
module.exports = defaultService;
module.exports.WhatsAppService = WhatsAppService;
