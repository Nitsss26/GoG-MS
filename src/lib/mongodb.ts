import mongoose from 'mongoose';
import { onDbConnected } from '@/lib/db-startup';
import { setServers } from "node:dns/promises";

// Configure DNS servers globally to avoid timeouts
try {
    setServers(["1.1.1.1", "8.8.8.8"]);
} catch (error) {
    console.warn("Failed to set DNS servers:", error);
}

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
    cached = (global as any).mongoose = { conn: null, promise: null, uri: null };
}

/** Database name in the URI ("" when none is given — MongoDB then uses "test"). Never logs the URI itself. */
const dbNameInUri = (uri: string) => {
    const m = uri.match(/^mongodb(?:\+srv)?:\/\/[^/]+\/([^?]*)/);
    return m ? decodeURIComponent(m[1] || '') : '';
};

async function dbConnect() {
    // Read the URI on every call: when .env.local changes, `next dev` reloads it, and the old
    // cached connection (to the previous database) must not keep being used.
    const uri = process.env.MONGODB_URI || MONGODB_URI!;
    if (cached.uri && cached.uri !== uri && (cached.conn || cached.promise)) {
        console.warn("[DB] MONGODB_URI changed — reconnecting to the new database.");
        try { await (cached.conn || (await cached.promise))?.disconnect(); } catch { /* old connection already closed */ }
        cached.conn = null;
        cached.promise = null;
    }

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

        cached.uri = uri;
        if (!dbNameInUri(uri)) {
            console.warn('[DB] MONGODB_URI has no database name, so MongoDB uses the default database "test". If your data is in another database, add "/<database-name>" before "?" in the URI.');
        }
        cached.promise = mongoose.connect(uri, opts).then(async (mongoose) => {
            console.log(`[DB] Connected successfully to database "${mongoose.connection.db?.databaseName}".`);
            await onDbConnected(mongoose.connection.db);
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