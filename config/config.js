const config = {
	MONGO_URI: process.env.MONGO_URI,
	SALT_ROUNDS: process.env.SALT_ROUNDS,
	EMAIL_FROM: process.env.EMAIL_FROM,
	EMAIL_PASS: process.env.EMAIL_PASS,
	JWT_SECRET: process.env.JWT_SECRET,
	CORS_ORIGIN: process.env.CORS_ORIGIN,
	PORT: process.env.PORT,
	ICE_SERVERS_API_KEY: process.env.ICE_SERVER_API_KEY,
};

module.exports = config;
