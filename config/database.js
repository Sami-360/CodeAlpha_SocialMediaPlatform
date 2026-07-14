import mongoose from 'mongoose';

const getConnectionUri = (mongoUri) => {
  const hosts = process.env.MONGO_STANDARD_HOSTS;
  const replicaSet = process.env.MONGO_REPLICA_SET;

  if (!hosts || !replicaSet || !mongoUri.startsWith('mongodb+srv://')) return mongoUri;

  const parsedUri = new URL(mongoUri);
  const database = parsedUri.pathname && parsedUri.pathname !== '/' ? parsedUri.pathname : '/codealpha_social_media';
  const credentials = `${parsedUri.username}:${parsedUri.password}`;
  const options = new URLSearchParams({
    tls: 'true',
    replicaSet,
    authSource: 'admin',
    retryWrites: 'true',
    w: 'majority',
    appName: 'Cluster0'
  });

  return `mongodb://${credentials}@${hosts}${database}?${options}`;
};

const connectDatabase = async () => {
  const mongoUri = process.env.MONGO_URI;

  if (!mongoUri || mongoUri === 'your_mongodb_connection_string') {
    throw new Error('MONGO_URI is not configured. Add a valid MongoDB connection string to .env.');
  }

  await mongoose.connect(getConnectionUri(mongoUri), { serverSelectionTimeoutMS: 15000 });
  console.log('MongoDB connected');
};

export default connectDatabase;
