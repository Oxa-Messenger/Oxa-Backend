const { v4: uuidv4 } = require("uuid");

module.exports = (io) => {
	// userId -> socketId
	const users = new Map();
	// socketId -> userId
	const socketToUser = new Map();
	// roomId -> Set<userId>
	const rooms = new Map();
	// canonical key for a set/pair of users -> roomId
	const pairToRoom = new Map();

	// config
	const MESH_SOFT_CAP = 8;

	const sortedKeyFrom = (arr) => Array.from(arr).map(String).sort().join(":");

	io.on("connection", (socket) => {
		console.log("A user connected:", socket.id);

		/* --------------------
       Registration / single-session enforcement
       -------------------- */
		socket.on("register", ({ userId }) => {
			console.log("register payload: ", userId);
			if (!userId) {
				console.warn(
					"register called with missing userId from socket",
					socket.id
				);
				io.to(socket.id).emit("registered", {
					ok: false,
					err: "missing-userId",
				});
				return;
			}

			// if user already connected, force old socket to logout
			const existingSocketId = users.get(userId);
			if (existingSocketId && existingSocketId !== socket.id) {
				io.to(existingSocketId).emit("force-logout", {
					reason: "new-session",
				});
				// remove previous mapping (will be cleaned when old socket disconnects)
				socketToUser.delete(existingSocketId);
			}

			users.set(userId, socket.id);
			socketToUser.set(socket.id, userId);
			socket.data.userId = userId;

			socket.broadcast.emit("user_online", { userId });

			io.to(socket.id).emit("registered", { ok: true });
			console.log(`registered user ${userId} -> ${socket.id}`);
		});

		/* --------------------
       Get or create canonical 1:1 room
       Client calls: socket.emit('get_or_create_room', { withUser: otherUserId }, cb)
       cb receives { roomId }
       -------------------- */
		socket.on("get_or_create_room", ({ withUser }, cb) => {
			const me = socket.data?.userId;
			if (!me || !withUser) {
				const err = "get_or_create_room missing params";
				if (typeof cb === "function") cb({ error: err });
				return;
			}

			// canonical key for the pair
			const key = sortedKeyFrom([me, withUser]);

			if (pairToRoom.has(key)) {
				const existing = pairToRoom.get(key);
				if (typeof cb === "function")
					cb({ roomId: existing, reused: true });
				return;
			}

			// create and register room
			const roomId = uuidv4();
			pairToRoom.set(key, roomId);
			rooms.set(roomId, new Set([me])); // only creator is present initially
			console.log(`created 1:1 room ${roomId} for ${key}`);

			if (typeof cb === "function") cb({ roomId, reused: false });
		});

		/* --------------------
       Room join/leave (groups + 1:1 after get_or_create_room)
       -------------------- */
		socket.on("room:join", ({ roomId }) => {
			const me = socket.data?.userId;
			if (!me || !roomId) return;

			socket.join(roomId);

			if (!rooms.has(roomId)) rooms.set(roomId, new Set());
			rooms.get(roomId).add(me);

			// return list of peers (excluding self)
			const peers = Array.from(rooms.get(roomId)).filter((u) => u !== me);
			io.to(socket.id).emit("room:peers", { roomId, peers });

			socket.to(roomId).emit("room:user-joined", { roomId, userId: me });
			console.log(`${me} joined ${roomId}`);
		});

		socket.on("room:leave", ({ roomId }) => {
			const me = socket.data?.userId;
			if (!me || !roomId) return;

			socket.leave(roomId);
			rooms.get(roomId)?.delete(me);
			socket.to(roomId).emit("room:user-left", { roomId, userId: me });
			console.log(`${me} left ${roomId}`);

			if (rooms.get(roomId)?.size === 0) {
				rooms.delete(roomId);
				// also remove pairToRoom entries that point to this room (cleanup)
				for (const [k, v] of pairToRoom.entries()) {
					if (v === roomId) pairToRoom.delete(k);
				}
			}
		});

		/* --------------------
       1:1 direct signaling helpers (route by 'to' userId if possible)
       - webrtc-offer: { to, sdp, meta? }
       - webrtc-answer: { to, sdp }
       - webrtc-ice: { to, candidate }
       If 'to' is not present, we also allow 'room' broadcast fallback.
       -------------------- */
		socket.on("webrtc-offer", ({ to, sdp, meta, room }) => {
			const from = socket.data?.userId;
			if (!from) return;
			if (to) {
				const target = users.get(to);
				if (target) {
					io.to(target).emit("webrtc-offer", { from, sdp, meta });
					return;
				}
			}
			// fallback: broadcast to room (exclude sender)
			if (room) {
				socket.to(room).emit("webrtc-offer", { from, sdp, meta });
			}
		});

		socket.on("webrtc-answer", ({ to, sdp, room }) => {
			const from = socket.data?.userId;
			if (!from) return;
			if (to) {
				const target = users.get(to);
				if (target) {
					io.to(target).emit("webrtc-answer", { from, sdp });
					return;
				}
			}
			if (room) {
				socket.to(room).emit("webrtc-answer", { from, sdp });
			}
		});

		socket.on("webrtc-ice", ({ to, candidate, room }) => {
			const from = socket.data?.userId;
			if (!from) return;
			if (to) {
				const target = users.get(to);
				if (target) {
					io.to(target).emit("webrtc-ice", { from, candidate });
					return;
				}
			}
			if (room) {
				socket.to(room).emit("webrtc-ice", { from, candidate });
			}
		});

		/* --------------------
       notify_waiting: simple ring/push event to a specific user
       -------------------- */
		socket.on("notify_waiting", ({ to }) => {
			const from = socket.data?.userId;
			if (!from || !to) return;
			const target = users.get(to);
			if (target) {
				io.to(target).emit("notify_waiting", { from });
			}
		});

		/* --------------------
       Room listing convenience (optional)
       -------------------- */
		socket.on("room:list", (cb) => {
			try {
				const res = {};
				for (const [roomId, set] of rooms.entries()) {
					res[roomId] = Array.from(set);
				}
				if (typeof cb === "function") cb({ ok: true, rooms: res });
			} catch (err) {
				if (typeof cb === "function")
					cb({ ok: false, err: String(err) });
			}
		});

		/* --------------------
       Disconnect cleanup
       -------------------- */
		socket.on("disconnect", () => {
			const me = socketToUser.get(socket.id) || socket.data?.userId;
			if (me) {
				users.delete(me);
				socketToUser.delete(socket.id);

				socket.broadcast.emit("user_offline", { userId: me });

				// remove user from any rooms they're in
				for (const [roomId, set] of rooms.entries()) {
					if (set.has(me)) {
						set.delete(me);
						socket
							.to(roomId)
							.emit("room:user-left", { roomId, userId: me });
					}
					if (set.size === 0) {
						rooms.delete(roomId);
						// cleanup pairToRoom references for deleted room
						for (const [k, v] of pairToRoom.entries()) {
							if (v === roomId) pairToRoom.delete(k);
						}
					}
				}

				console.log(`user ${me} disconnected`);
			} else {
				console.log("socket disconnected: ", socket.id);
			}
		});
	});
};
