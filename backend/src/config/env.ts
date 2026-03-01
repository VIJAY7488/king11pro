import dotenv from 'dotenv';


dotenv.config();


const config = {
    port : parseInt(process.env.PORT ?? '3000', 10),

    // MongoDB
    mongoUri: process.env.MONGODB_URL,


    // JWT
    jwtSecret: process.env.JWT_SECRET,
    jwtExpiresIn: process.env.JWT_EXPIRES_IN ?? '7d',
    jwtRefreshSecret: process.env.JWT_REFRESH_SECRET ?? 'refresh_change_me_in_production',
    jwtRefreshExpiresIn: process.env.JWT_REFRESH_EXPIRES_IN ?? '30d',
} as const;

export default config;