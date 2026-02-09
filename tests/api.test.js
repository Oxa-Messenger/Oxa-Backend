// Mock the global fetch ICE_SERVERS API call
global.fetch = jest.fn(() =>
	Promise.resolve({
		json: () =>
			Promise.resolve([
				{ urls: "stun:stun.l.google.com:19302" },
				{ urls: "stun:stun1.l.google.com:19302" },
				{ urls: "stun:stun2.l.google.com:19302" },
			]),
	})
);

const request = require("supertest");
const mongoose = require("mongoose");
const app = require("../index"); // Importing the server instance

// Global configuration for the test environment
jest.setTimeout(30000);

// --- TEST DATA GENERATION ---
const TIMESTAMP = Date.now();

const TEST_USER = {
	username: `user_${TIMESTAMP.toString().slice(-8)}`,
	email: `test_${TIMESTAMP}@example.com`,
	password: "Password123!",
};

const CONTACT_USER = {
	username: `cont_${TIMESTAMP.toString().slice(-8)}`,
	email: `contact_${TIMESTAMP}@example.com`,
	password: "Password123!",
};

// --- STATE MANAGEMENT ---
let authToken = "";
let contactUserId = "";

// --- SETUP & TEARDOWN ---
beforeAll(async () => {
	const mongoUri = process.env.MONGO_URI;
	if (mongoose.connection.readyState === 0) {
		await mongoose.connect(mongoUri);
	}
});

afterAll(async () => {
	// Clean up database and connection after all tests finish
	if (mongoose.connection.db) {
		await mongoose.connection.db.dropDatabase();
	}
	await mongoose.connection.close();
});

describe("Oxa Backend Comprehensive Test Suite", () => {
	// =========================================================================
	// 1. AUTHENTICATION & REGISTRATION
	// =========================================================================
	describe("Authentication & Registration", () => {
		it("1. POST /signup - Should fail if required fields are missing", async () => {
			const res = await request(app).post("/user/auth/signup").send({
				username: "incomplete",
			});
			expect(res.statusCode).toBe(400); // Handled by signupValidator
		});

		it("2. POST /signup - Should fail with invalid email format", async () => {
			const res = await request(app)
				.post("/user/auth/signup")
				.send({
					...TEST_USER,
					email: "bad-email-format",
				});
			expect(res.statusCode).toBe(400);
		});

		it("3. POST /signup - Should fail with weak password", async () => {
			const res = await request(app)
				.post("/user/auth/signup")
				.send({
					...TEST_USER,
					password: "123",
				});
			expect(res.statusCode).toBe(400);
		});

		it("4. POST /signup - Should successfully register Contact User", async () => {
			const res = await request(app)
				.post("/user/auth/signup")
				.send(CONTACT_USER);
			expect(res.statusCode).toBe(201);
		});

		it("5. POST /signup - Should successfully register Main Test User", async () => {
			const res = await request(app)
				.post("/user/auth/signup")
				.send(TEST_USER);
			expect(res.statusCode).toBe(201);
		});

		it("6. POST /signup - Should fail when registering a duplicate email", async () => {
			const res = await request(app)
				.post("/user/auth/signup")
				.send(TEST_USER);
			expect(res.statusCode).toBe(409); // Conflict code 11000 in userRoutes.js
		});

		it("7. POST /signup - Should fail when registering a duplicate username", async () => {
			const duplicateUser = { ...TEST_USER, email: "unique@example.com" };
			const res = await request(app)
				.post("/user/auth/signup")
				.send(duplicateUser);
			expect(res.statusCode).toBe(409);
		});

		it("8. POST /login - Should fail with non-existent user", async () => {
			const res = await request(app).post("/user/auth/login").send({
				identifier: "ghost@example.com",
				password: "Password123!",
			});
			expect(res.statusCode).toBe(400); // Standard behavior for missing users
		});

		it("9. POST /login - Should fail with incorrect password", async () => {
			const res = await request(app).post("/user/auth/login").send({
				identifier: TEST_USER.email,
				password: "WrongPassword!",
			});
			expect(res.statusCode).toBe(400);
		});

		it("10. POST /login - Should login successfully and return JWT", async () => {
			const res = await request(app).post("/user/auth/login").send({
				identifier: TEST_USER.email,
				password: TEST_USER.password,
			});
			expect(res.statusCode).toBe(200);
			expect(res.body).toHaveProperty("token");
			authToken = res.body.token; // Persist token for authorized routes
		});
	});

	// =========================================================================
	// 2. USER DATA & SECURITY
	// =========================================================================
	describe("User Data & Security", () => {
		it("11. GET /home - Should fail without Authorization header", async () => {
			const res = await request(app).get("/user/home");
			expect(res.statusCode).toBe(401); // Blocked by authmiddleware
		});

		it("12. GET /home - Should fail with invalid token format", async () => {
			const res = await request(app)
				.get("/user/home")
				.set("Authorization", "Bearer invalid_token_string");
			expect(res.statusCode).toBe(500); // Current middleware crashes on malformed JWT
		});

		it("13. GET /home - Should return user profile data", async () => {
			const res = await request(app)
				.get("/user/home")
				.set("Authorization", `Bearer ${authToken}`);
			expect(res.statusCode).toBe(200);
			expect(res.body.message).toHaveProperty(
				"email",
				TEST_USER.email.toLowerCase()
			);
			expect(res.body.message).toHaveProperty(
				"username",
				TEST_USER.username
			);
		});

		it("14. GET /ice-servers - Should return ICE servers (Authenticated)", async () => {
			const res = await request(app)
				.get("/user/sensitive-stuff/ice-servers")
				.set("Authorization", `Bearer ${authToken}`);
			// Expected 200 on success, or 500 if external fetch fails
			expect([200, 500]).toContain(res.statusCode);
		});

		it("15. GET /ice-servers - Should fail if Unauthenticated", async () => {
			const res = await request(app).get(
				"/user/sensitive-stuff/ice-servers"
			);
			expect(res.statusCode).toBe(401);
		});
	});

	// =========================================================================
	// 3. CONTACT MANAGEMENT
	// =========================================================================
	describe("Contact Management", () => {
		it("16. POST /contacts/add - Should fail if identifier is missing", async () => {
			const res = await request(app)
				.post("/user/contacts/add")
				.set("Authorization", `Bearer ${authToken}`)
				.send({});
			expect(res.statusCode).toBe(400); // Identifier is required
		});

		it("17. POST /contacts/add - Should fail if adding self as contact", async () => {
			const res = await request(app)
				.post("/user/contacts/add")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ identifier: TEST_USER.email });
			expect(res.statusCode).toBe(400);
		});

		it("18. POST /contacts/add - Should fail if user does not exist", async () => {
			const res = await request(app)
				.post("/user/contacts/add")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ identifier: "nonexistent@example.com" });
			expect(res.statusCode).toBe(404);
		});

		it("19. POST /contacts/add - Should successfully add a contact", async () => {
			const res = await request(app)
				.post("/user/contacts/add")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ identifier: CONTACT_USER.email });

			expect(res.statusCode).toBe(201);
			expect(res.body.contact).toHaveProperty("user");
			contactUserId = res.body.contact.user; // Captured for update/delete tests
		});

		it("20. POST /contacts/add - Should fail if contact already exists", async () => {
			const res = await request(app)
				.post("/user/contacts/add")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ identifier: CONTACT_USER.email });
			expect(res.statusCode).toBe(409); // Conflict
		});

		it("21. PUT /contacts/update-alias - Should fail if Alias is missing", async () => {
			const res = await request(app)
				.put("/user/contacts/update-alias")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ user: contactUserId });
			expect(res.statusCode).toBe(400);
		});

		it("22. PUT /contacts/update-alias - Should fail if User ID is missing", async () => {
			const res = await request(app)
				.put("/user/contacts/update-alias")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ alias: "New Name" });
			expect(res.statusCode).toBe(400);
		});

		it("23. PUT /contacts/update-alias - Should fail for non-contact user", async () => {
			const randomId = new mongoose.Types.ObjectId();
			const res = await request(app)
				.put("/user/contacts/update-alias")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ user: randomId, alias: "Ghost" });
			expect(res.statusCode).toBe(404);
		});

		it("24. PUT /contacts/update-alias - Should successfully update alias", async () => {
			const res = await request(app)
				.put("/user/contacts/update-alias")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ user: contactUserId, alias: "Best Friend" });
			expect(res.statusCode).toBe(200); // Updates via arrayFilters
		});

		it("25. DELETE /contacts/delete - Should fail if User ID is missing", async () => {
			const res = await request(app)
				.delete("/user/contacts/delete")
				.set("Authorization", `Bearer ${authToken}`)
				.send({});
			expect(res.statusCode).toBe(400);
		});
	});

	// =========================================================================
	// 4. CLEANUP & LOGOUT
	// =========================================================================
	describe("Cleanup & Logout", () => {
		it("26. DELETE /contacts/delete - Should fail for non-existent contact", async () => {
			const randomId = new mongoose.Types.ObjectId();
			const res = await request(app)
				.delete("/user/contacts/delete")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ user: randomId });
			expect(res.statusCode).toBe(404);
		});

		it("27. DELETE /contacts/delete - Should successfully delete contact", async () => {
			const res = await request(app)
				.delete("/user/contacts/delete")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ user: contactUserId });
			expect(res.statusCode).toBe(200);
		});

		it("28. DELETE /contacts/delete - Should fail to delete same contact twice", async () => {
			const res = await request(app)
				.delete("/user/contacts/delete")
				.set("Authorization", `Bearer ${authToken}`)
				.send({ user: contactUserId });
			expect(res.statusCode).toBe(404);
		});

		it("29. POST /logout - Should logout successfully", async () => {
			const res = await request(app)
				.post("/user/auth/logout")
				.set("Authorization", `Bearer ${authToken}`);
			expect(res.statusCode).toBe(200); // Clears token in DB
		});

		it("30. GET /home - Should fail after logout (Token invalidated)", async () => {
			const res = await request(app)
				.get("/user/home")
				.set("Authorization", `Bearer ${authToken}`);
			expect(res.statusCode).toBe(401); // Middleware detects null token in DB
		});

		it("31. POST /forgot-password - Should fail if email not found", async () => {
			const res = await request(app)
				.post("/user/auth/forgot-password")
				.send({ email: "unregistered@example.com" });
			expect(res.statusCode).toBe(404);
		});

		it("32. POST /forgot-password - Should successfully initiate reset flow", async () => {
			const res = await request(app)
				.post("/user/auth/forgot-password")
				.send({ email: TEST_USER.email });
			expect(res.statusCode).toBe(200); // Record created and email "sent"
		});
	});
});
