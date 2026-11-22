# 📱 WhatsApp Standalone Connector & Direct Sender

Extract of the WhatsApp direct connection & message sending engine from Reachly.

Connect your WhatsApp account once via QR code and **send messages directly through WhatsApp from any application or script without opening WhatsApp Web or your phone!**

---

## 🌟 Features

- **No Official Meta API or Business Verification needed**: Uses WebSocket Baileys engine.
- **Persistent Login**: Sessions are saved on disk in `./sessions/`. Once scanned, it stays connected even if the server restarts.
- **Simple REST API**: Send messages with a single `POST /api/send` HTTP call.
- **Direct Code Integration**: Import `whatsappService.js` directly into any other Node.js project.
- **Built-in Web Test UI**: Open in your browser (`http://localhost:5050`) to connect, scan QR, and test message sending.
- **Automatic Phone Formatting**: Accepts `919819984437`, `+91 98199-84437`, etc., and automatically converts to WhatsApp's JID.

---

## 🚀 Quick Start (Running Standalone)

### 1. Install Dependencies
Open a terminal in this directory:
```bash
npm install
```

### 2. Start the Server
```bash
npm start
```
By default, the server runs on **port 5050**:
- Web UI: **http://localhost:5050**
- API URL: **http://localhost:5050/api/send**

---

## 🛠️ How to Integrate into Other Apps

### Method 1: Using REST API (Works with Any Language: Python, PHP, Java, C#, Frontend)

#### **cURL Example:**
```bash
curl -X POST http://localhost:5050/api/send \
  -H "Content-Type: application/json" \
  -d '{
    "to": "919819984437",
    "text": "Hello! Your invoice #1024 is ready."
  }'
```

#### **JavaScript / Frontend (fetch):**
```javascript
async function sendWhatsApp(phoneNumber, message) {
  const response = await fetch('http://localhost:5050/api/send', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      to: phoneNumber,
      text: message
    })
  });
  const data = await response.json();
  if (data.ok) {
    console.log('WhatsApp message sent successfully!');
  } else {
    console.error('Error sending message:', data.error);
  }
}

// Call function:
sendWhatsApp('919819984437', 'Hello from my web app!');
```

#### **Python Example:**
```python
import requests

def send_whatsapp(phone, message):
    url = "http://localhost:5050/api/send"
    payload = {
        "to": phone,
        "text": message
    }
    res = requests.post(url, json=payload)
    return res.json()

# Send message:
print(send_whatsapp("919819984437", "Hello from Python script!"))
```

#### **PHP Example:**
```php
<?php
$data = array("to" => "919819984437", "text" => "Hello from PHP!");
$ch = curl_init("http://localhost:5050/api/send");
curl_setopt($ch, CURLOPT_RETURNTRANSFER, true);
curl_setopt($ch, CURLOPT_POST, true);
curl_setopt($ch, CURLOPT_POSTFIELDS, json_encode($data));
curl_setopt($ch, CURLOPT_HTTPHEADER, array('Content-Type: application/json'));
$response = curl_exec($ch);
curl_close($ch);
echo $response;
?>
```

---

### Method 2: Direct Node.js Import (No HTTP Overhead)

If your other app is built with Node.js / Express / NestJS, you can simply copy `whatsappService.js` into your project and use it directly:

```javascript
const waService = require('./whatsappService');

async function main() {
  // 1. Initialize session (restores saved login if available)
  await waService.startSession('default');

  // 2. Send message directly:
  const result = await waService.sendMessage('default', '919819984437', 'Hello from direct Node.js import!');
  console.log('Result:', result);
}

main();
```

---

## 📡 REST API Reference

| Method | Endpoint | Description | Payload |
|---|---|---|---|
| `GET` | `/api/status` | Get connection status (`connected`, `qr`, `disconnected`) | Query: `?sessionId=default` |
| `POST` | `/api/connect` | Initialize session and generate QR code | Body: `{"sessionId": "default"}` |
| `GET` | `/api/qr-stream` | Real-time SSE stream of QR code and connection updates | Query: `?sessionId=default` |
| `POST` | `/api/send` | Send a text message | Body: `{"to": "91...", "text": "Hello"}` |
| `POST` | `/api/disconnect` | Log out and remove session from disk | Body: `{"sessionId": "default"}` |

---

## 📁 File Structure

```text
whatsapp-standalone-connector/
├── package.json           # Minimal dependencies: baileys, qrcode, express, cors, pino
├── whatsappService.js     # Pure engine (connection, QR handler, message sending)
├── server.js              # REST API server & static file host (port 5050)
├── public/
│   └── index.html         # Modern web UI to scan QR and test sending
└── sessions/              # Created automatically on first scan (stores auth tokens)
```
