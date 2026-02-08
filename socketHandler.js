const { v4: uuidv4 } = require("uuid");
const User = require("./model/User");

module.exports = (io) => {
	// userId -> socketId
	const users = new Map();
	// userId -> Set<roomId>
	const userToRooms = new Map();
	// socketId -> userId
	const socketToUser = new Map();
	// roomId -> { users: Set, pairKey: string }
	const rooms = new Map();
	// "id1:id2" -> roomId
	const pairToRoom = new Map();

	// config
	const MESH_SOFT_CAP = 8;

	const sortedKeyFrom = (arr) => Array.from(arr).map(String).sort().join(":");

	io.on("connection", (socket) => {
		console.log("A user connected:", socket.id);

		/* --------------------
       Registration / single-session enforcement
       -------------------- */
		socket.on("register", async ({ userId }) => {
			console.log("register payload: ", userId);
			if (!userId) {
				console.warn(
					"register called with missing userId from socket",
					socket.id
				);
				return socket.emit("registered", {
					ok: false,
					err: "missing-userId",
				});
			}

			// if user already connected, force old socket to logout
			const existingSocketId = users.get(userId);
			if (existingSocketId && existingSocketId !== socket.id) {
				console.log(`Kicking out old session for user ${userId}`);
				const oldSocket = io.sockets.sockets.get(existingSocketId);
				if (oldSocket) {
					// Send a custom event so the frontend knows it was kicked
					oldSocket.emit("session_terminated", {
						reason: "Logged in from another device",
					});

					// 3. Forcefully disconnect the old socket
					oldSocket.disconnect(true);
				}
			}

			const currentUserId = userId.toString();
			users.set(currentUserId, socket.id);
			socketToUser.set(socket.id, currentUserId);
			socket.data.userId = currentUserId;

			try {
				const user = await User.findById(currentUserId).select(
					"contact"
				);
				const myContacts = user?.contact || [];

				const myOnlineContacts = [];

				myContacts.forEach((contactObj) => {
					const cid = contactObj.user.toString();
					if (users.has(cid)) {
						myOnlineContacts.push(cid);
						io.to(users.get(cid)).emit("user_online", {
							userId: currentUserId,
						});
					}
				});

				socket.emit("users_list", { users: myOnlineContacts });
			} catch (err) {
				console.error("Error fetching contacts in register:", err);
				socket.emit("users_list", { users: [] });
			}

			socket.emit("registered", { ok: true });
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
				return cb?.({ error: "Missing params" });
			}

			// canonical key for the pair
			const key = sortedKeyFrom([me, withUser]);
			let roomId = pairToRoom.get(key);
			let reused = true;

			if (!roomId) {
				roomId = uuidv4();
				pairToRoom.set(key, roomId);
				rooms.set(roomId, {
					users: new Set(),
					initiator: me,
					pairKey: key,
				});
				reused = false;
			}
			console.log(`created 1:1 room ${roomId} for ${key}`);

			cb?.({ roomId, reused });
		});

		/* --------------------
       Room join/leave (groups + 1:1 after get_or_create_room)
       -------------------- */
		socket.on("room:join", ({ roomId }) => {
			const me = socket.data?.userId;
			if (!me || !roomId) return;

			socket.join(roomId);

			if (!rooms.has(roomId))
				rooms.set(roomId, {
					users: new Set(),
					pairKey: null,
				});

			const room = rooms.get(roomId);
			room.users.add(me);

			if (!userToRooms.has(me)) userToRooms.set(me, new Set());
			userToRooms.get(me).add(roomId);

			socket.emit("room:sync", {
				// in place of (io.to(socket.id).emit("room:peers", { roomId, peers });)
				roomId,
				peers: Array.from(room.users),
				initiator: room.initiator,
			});

			socket.to(roomId).emit("room:user-joined", { roomId, userId: me });

			console.log(`${me} joined ${roomId}`);
		});

		socket.on("room:leave", ({ roomId }) => {
			const me = socket.data?.userId;
			if (!me || !roomId) return;

			const room = rooms.get(roomId);

			if (room) {
				room.users.delete(me);
				userToRooms.get(me)?.delete(roomId);

				socket
					.to(roomId)
					.emit("room:user-left", { roomId, userId: me });
				console.log(`${me} left ${roomId}`);

				if (room.users.size === 0) {
					if (room.pairKey) pairToRoom.delete(room.pairKey);
					rooms.delete(roomId);
					console.log(`Room ${roomId} deleted (empty)`);
				}
			}
			socket.leave(roomId);
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

		// SIGNALING (Optimized)
		const forwardSignal = (event, data) => {
			const from = socket.data?.userId;
			if (!from) return;

			if (data.to) {
				const targetSocket = users.get(data.to);
				if (targetSocket) {
					io.to(targetSocket).emit(event, { ...data, from });
					return;
				}
			}
			if (data.room) {
				socket.to(data.room).emit(event, { ...data, from });
			}
		};

		socket.on("webrtc-offer", (data) =>
			forwardSignal("webrtc-offer", data)
		);
		socket.on("webrtc-answer", (data) =>
			forwardSignal("webrtc-answer", data)
		);
		socket.on("webrtc-ice", (data) => forwardSignal("webrtc-ice", data));

		socket.on("disconnect", async () => {
			const me = socketToUser.get(socket.id);
			if (!me) return;

			// Only delete from 'users' if THIS socket is the current active one for that user
			if (users.get(me) === socket.id) {
				users.delete(me);
				try {
					const user = await User.findById(me).select("contact");
					const myContacts = user?.contact || [];

					myContacts.forEach((contactObj) => {
						const cid = contactObj.user.toString();

						if (users.has(cid)) {
							const targetSocketId = users.get(cid);
							io.to(targetSocketId).emit("user_offline", {
								userId: me,
							});
						}
					});
					console.log(
						`User ${me} went offline. Notified online contacts.`
					);
				} catch (err) {
					console.error(
						"Error notifying contacts on disconnect:",
						err
					);
				}
			}
			socketToUser.delete(socket.id);

			const activeRooms = userToRooms.get(me);
			if (activeRooms) {
				activeRooms.forEach((roomId) => {
					const room = rooms.get(roomId);
					if (room) {
						room.users.delete(me);
						socket
							.to(roomId)
							.emit("room:user-left", { roomId, userId: me });

						if (room.users.size === 0) {
							if (room.pairKey) pairToRoom.delete(room.pairKey);
							rooms.delete(roomId);
						}
					}
				});
				userToRooms.delete(me);
			}
		});
	});
};
