import mongoose from 'mongoose';

let connectionPromise = null;
let lastConnectionError = null;

export function isDatabaseConfigured() {
  return Boolean(process.env.MONGODB_URI && process.env.MONGODB_URI.trim());
}

export function isDatabaseConnected() {
  return mongoose.connection.readyState === 1;
}

export function getDatabaseStatus() {
  return {
    databaseConfigured: isDatabaseConfigured(),
    databaseConnected: isDatabaseConnected(),
    error: isDatabaseConnected() ? null : lastConnectionError,
  };
}

export async function connectDatabase() {
  const uri = process.env.MONGODB_URI?.trim();
  if (!uri) {
    lastConnectionError = null;
    return false;
  }

  if (mongoose.connection.readyState === 1) {
    lastConnectionError = null;
    return true;
  }

  if (connectionPromise) {
    return connectionPromise;
  }

  connectionPromise = mongoose
    .connect(uri, {
      serverSelectionTimeoutMS: 8000,
      maxPoolSize: 10,
    })
    .then(() => {
      lastConnectionError = null;
      console.log('Connected to MongoDB Atlas successfully.');
      return true;
    })
    .catch((err) => {
      lastConnectionError = err.message || 'Failed to connect to MongoDB Atlas.';
      console.error('MongoDB Atlas connection warning (running in Guest Mode):', lastConnectionError);
      return false;
    })
    .finally(() => {
      connectionPromise = null;
    });

  return connectionPromise;
}
