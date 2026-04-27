# Oxa Backend

Oxa Backend is the **minimal, zero-trust signaling and authentication layer** for the Oxa ecosystem.
It **never stores or reads user messages** — its only role is to enable secure, ephemeral communication between clients.

---

## 🚀 Core Philosophy

The backend is intentionally **thin and restricted**:

- ❌ No message storage
- ❌ No plaintext access
- ❌ No chat history
- ✅ Authentication only
- ✅ Signaling for WebRTC
- ✅ Presence tracking

---

## 🧠 Responsibilities

The backend exists strictly for:

### 1. 🔐 Authentication

- Email-based login (OTP verification)
- Token issuance (JWT or similar)
- Session validation

### 2. 🔁 Signaling Server

- WebRTC offer/answer exchange
- ICE candidate relay
- Peer discovery

### 3. 🟢 Presence System

- Track online/offline users
- No “last seen” storage
- Real-time availability only

---

## 🏗️ Tech Stack

- **Runtime:** Node.js
- **Framework:** Express.js
- **Real-time:** WebSocket / Socket.IO
- **Auth:** JWT (email OTP)
- **Database:** Minimal (users + metadata only)
- **Crypto:** End-to-End Encryption handled on client

---

## 📂 Project Structure

```
src/
│── controllers/     # Request handlers
│── routes/          # API routes
│── services/        # Business logic (auth, signaling)
│── sockets/         # WebSocket / signaling logic
│── middleware/      # Auth, rate limiting, validation
│── models/          # User & metadata schemas
│── utils/           # Helpers
│── config/          # Env & configuration
```

---

## ⚙️ Setup & Installation

### 1. Clone Repo

```bash
git clone https://github.com/Oxa-Messenger/Oxa-Backend.git
cd Oxa-Backend
```

### 2. Install Dependencies

```bash
npm ci
```

### 3. Configure Environment

Create `.env` file. Checkout `config/config.js`

### 4. Run Server

```bash
npm run dev
```

---

## 🔐 Security Model

- Zero-trust server design
- Server never sees chat
- End-to-end encryption enforced at client level
- No sensitive logging
- Rate limiting

---

## 🔄 Architecture Flow

```
Client A → Backend (Signaling) → Client B
        ↘ Direct WebRTC (Encrypted) ↙
```

- Backend only helps establish connection
- Actual communication is **peer-to-peer**

---

## 🚧 Roadmap

- [ ] OTP email verification system
- [ ] WebRTC signaling server
- [ ] Presence tracking (real-time)
- [ ] Rate limiting

---

## ⚠️ Important Constraints

- Never store messages
- Never log message content
- Never access encryption keys
- Always assume clients can be malicious

---

## ⚡ Vision

> “The server should know nothing.”

Oxa Backend exists only to **connect users — not to observe them**.
