import mongoose from 'mongoose';

const MONGODB_URI = process.env.MONGODB_URI;

if (!MONGODB_URI) {
    throw new Error('Please define the MONGODB_URI environment variable inside .env.local');
}

/**
 * Global is used here to maintain a cached connection across hot reloads
 * in development. This prevents connections growing exponentially
 * during API Route usage.
 */
let cached = (global as any).mongoose;

if (!cached) {
    cached = (global as any).mongoose = { conn: null, promise: null };
}

async function dbConnect() {
    // If we have a cached connection, verify it's still alive
    if (cached.conn) {
        try {
            // Quick ping to check if connection is still alive
            if (cached.conn.connection.readyState === 1) {
                return cached.conn;
            }
            // Connection is stale/closed — clear it
            console.warn("[DB] Stale connection detected (state:", cached.conn.connection.readyState, "). Reconnecting...");
            cached.conn = null;
            cached.promise = null;
        } catch {
            cached.conn = null;
            cached.promise = null;
        }
    }

    if (!cached.promise) {
        const opts = {
            bufferCommands: false,
            serverSelectionTimeoutMS: 5000,
            heartbeatFrequencyMS: 10000,
            maxPoolSize: 50,
            socketTimeoutMS: 45000,
            connectTimeoutMS: 10000,
        };

        cached.promise = mongoose.connect(MONGODB_URI!, opts).then((mongoose) => {
            console.log("[DB] Connected successfully.");
            return mongoose;
        });
    }

    try {
        cached.conn = await cached.promise;
    } catch (e) {
        cached.promise = null;
        cached.conn = null;
        throw e;
    }

    return cached.conn;
}

export default dbConnect;
