# Oxa Backend

The backend server for **Oxa** — a secure, privacy-focused real-time messaging app built on ephemeral, RAM-based communication. The server never stores or reads user messages; its sole responsibilities are authentication, WebRTC signaling, and presence tracking.

---

## Core Philosophy

The backend is intentionally thin and restricted:

- No message storage — rooms and state live in memory only
- No plaintext access to user content
- No chat history persistence
- JWT-based authentication with single-active-session enforcement
- WebRTC signaling relay for peer-to-peer communication
- Mutual-contact presence tracking

---

## Tech Stack

| Layer | Technology |
|---|---|
| Runtime | Node.js |
| Framework | Express 5 |
| Database | MongoDB (Mongoose 8) |
| Real-time | Socket.IO 4 |
| Auth | JWT (jsonwebtoken), bcrypt |
| Email | Nodemailer (Gmail) |
| Validation | express-validator, express-rate-limit |
| Security | helmet, cors, compression |
| Testing | Jest, Supertest |

---

## Project Structure

```
├── config/
│   └── config.js               # Centralised env var config
├── middleware/
│   ├── jwtAuthMiddleware.js    # JWT auth for HTTP and WebSocket
│   └── validationMiddleware.js
├── model/
│   ├── User.js                 # Main user schema
│   ├── Community.js
│   ├── Group.js
│   ├── Room.js
│   ├── PinnedMessage.js
│   └── subModels/              # Contact, DeviceInfo, AccountSession, Settings, etc.
├── routes/
│   ├── userRoutes.js           # Auth + home; mounts sub-routers
│   ├── contactRoutes.js
│   ├── resetPasswordRoutes.js
│   └── sensitiveStuff.js       # ICE server credentials
├── validators/                 # express-validator chains + rate limiters
├── tests/
│   └── api.test.js
├── database.js                 # Mongoose connection
├── socketHandler.js            # All Socket.IO logic
└── index.js                    # Entry point
```

---

## API Reference

All routes are prefixed under `/user`.

### Auth

| Method | Path | Auth Required | Description |
|--------|------|:---:|---|
| `POST` | `/user/auth/signup` | No | Register with email, optional username, and password |
| `POST` | `/user/auth/login` | No (rate-limited) | Login by email or username; returns JWT |
| `POST` | `/user/auth/logout` | Yes | Invalidates token server-side |
| `GET`  | `/user/home` | Yes | Returns user profile, contacts, and joined communities/groups |
| `POST` | `/user/auth/forgot-password` | No (rate-limited) | Send 5-digit OTP to email |
| `POST` | `/user/auth/reset-password` | No (rate-limited) | Verify OTP and set new password |

### Contacts

| Method | Path | Auth Required | Description |
|--------|------|:---:|---|
| `POST`   | `/user/contacts/add` | Yes | Add a contact by email or username |
| `PUT`    | `/user/contacts/update-alias` | Yes | Rename a contact's local alias |
| `DELETE` | `/user/contacts/delete` | Yes | Remove a contact |

### Utilities

| Method | Path | Auth Required | Description |
|--------|------|:---:|---|
| `GET` | `/user/sensitive-stuff/ice-servers` | Yes | Return cached WebRTC ICE/TURN server credentials |

---

## Socket.IO Events

The socket connection requires a valid JWT passed via `socket.handshake.auth.token`.

### Client → Server

| Event | Payload | Description |
|---|---|---|
| `register` | `{ userId }` | Register presence and receive online contact list |
| `get_or_create_room` | `{ withUser }` | Get or create a canonical 1:1 room; callback receives `{ roomId, reused }` |
| `room:join` | `{ roomId }` | Join a room (1:1 or group) |
| `room:leave` | `{ roomId }` | Leave a room |
| `notify_waiting` | `{ to }` | Send a ring/push notification to a specific user |
| `webrtc-offer` | `{ to?, room?, ...sdp }` | Forward WebRTC offer |
| `webrtc-answer` | `{ to?, room?, ...sdp }` | Forward WebRTC answer |
| `webrtc-ice` | `{ to?, room?, ...candidate }` | Forward ICE candidate |

### Server → Client

| Event | Payload | Description |
|---|---|---|
| `registered` | `{ ok, err? }` | Confirms registration success or failure |
| `users_list` | `{ users: string[] }` | List of currently online mutual contacts |
| `user_online` | `{ userId }` | A mutual contact came online |
| `user_offline` | `{ userId }` | A mutual contact went offline |
| `session_terminated` | `{ reason }` | Sent to old session when a new login is detected |
| `room:sync` | `{ roomId, peers, initiator }` | Current room state sent on join |
| `room:user-joined` | `{ roomId, userId }` | A peer joined the room |
| `room:user-left` | `{ roomId, userId }` | A peer left the room |
| `notify_waiting` | `{ from }` | Incoming ring/push from another user |
| `webrtc-offer` | `{ from, ...sdp }` | Forwarded WebRTC offer |
| `webrtc-answer` | `{ from, ...sdp }` | Forwarded WebRTC answer |
| `webrtc-ice` | `{ from, ...candidate }` | Forwarded ICE candidate |

---

## Setup & Installation

### 1. Clone the repo

```bash
git clone https://github.com/Oxa-Messenger/Oxa-Backend.git
cd Oxa-Backend
```

### 2. Install dependencies

```bash
npm ci
```

### 3. Configure environment variables

Create a `.env` file in the project root:

```env
MONGO_URI=mongodb://localhost:27017/oxa
SALT_ROUNDS=12
EMAIL_FROM=your-email@gmail.com
EMAIL_PASS=your-gmail-app-password
JWT_SECRET=your-jwt-secret
CORS_ORIGIN=https://your-frontend-domain.com
PORT=10000
ICE_SERVER_API_KEY=https://your-metered-turn-api-url
```

| Variable | Description |
|---|---|
| `MONGO_URI` | MongoDB connection string |
| `SALT_ROUNDS` | bcrypt salt rounds |
| `EMAIL_FROM` | Gmail sender address |
| `EMAIL_PASS` | Gmail app password (not your account password) |
| `JWT_SECRET` | Secret key for signing JWTs |
| `CORS_ORIGIN` | Allowed CORS origin |
| `PORT` | HTTP server port |
| `ICE_SERVER_API_KEY` | Metered TURN API URL for WebRTC |

### 4. Run the server

```bash
# Development (auto-restart on file changes)
npm run dev

# Production
npm start
```

---

## Authentication

**HTTP:** JWT Bearer token. The client sends `Authorization: Bearer <token>` on protected routes. The middleware verifies the token signature and checks that it matches the token stored in MongoDB, enforcing single-active-session behavior. The stored token is cleared on logout.

**WebSocket:** Token is passed via `socket.handshake.auth.token` and verified by the `jwtAuthSocket` middleware before the connection is accepted.

**Password hashing:** bcrypt runs in a Mongoose `pre('save')` hook with configurable salt rounds.

---

## Key Features

- **Ephemeral rooms** — 1:1 and group rooms live entirely in memory and are auto-deleted when empty; no messages are persisted
- **Single-session enforcement** — a new login from any device kicks the existing session with a `session_terminated` event
- **Mutual-contact presence** — `user_online` / `user_offline` events are only exchanged between users who mutually have each other as contacts, preventing presence leaks
- **WebRTC signaling** — relays `webrtc-offer`, `webrtc-answer`, and `webrtc-ice` events; supports both targeted delivery (by `userId`) and room-based broadcast
- **Password reset via OTP** — cryptographically secure 5-digit PIN generated with `crypto.randomInt`, stored in memory with a 10-minute TTL and passive garbage collection
- **Rate limiting** — applied to login (prevents brute force), forgot-password, and reset-password endpoints
- **ICE server caching** — TURN credentials are fetched from the external Metered API once and cached in memory for the process lifetime
- **Graceful shutdown** — on `SIGTERM`, Socket.IO closes first, then the HTTP server drains, then the process exits; a 25-second force-exit safety timer prevents hangs

---

## Testing

```bash
npm test
```

Runs the Jest test suite with `--detectOpenHandles` and `--forceExit`.

---

## Security Model

- The server has zero access to message content
- End-to-end encryption is enforced at the client level
- Server-side token validation prevents session hijacking
- Rate limiting protects auth endpoints from abuse
- Email enumeration is prevented on the forgot-password endpoint (always returns 200)

---

## Architecture

```
Client A ──► Backend (Auth + Signaling + Presence) ◄── Client B
         └──────────────────────────────────────────┘
                  Direct WebRTC (P2P, Encrypted)
```

The backend helps establish connections. All actual communication is peer-to-peer.

---

## Author

**Abdullah Amir**
