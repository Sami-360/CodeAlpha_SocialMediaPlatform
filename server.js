import 'dotenv/config';
import cors from 'cors';
import express from 'express';
import path from 'path';
import { fileURLToPath } from 'url';
import connectDatabase from './config/database.js';
import authRoutes from './routes/authRoutes.js';
import userRoutes from './routes/userRoutes.js';
import postRoutes from './routes/postRoutes.js';
import commentRoutes from './routes/commentRoutes.js';

const app = express();
const port = Number(process.env.PORT) || 5000;
const publicDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'public');
const uploadsDirectory = path.join(path.dirname(fileURLToPath(import.meta.url)), 'uploads');

app.use(cors());
app.use(express.json({ limit: '1mb' }));
app.use(express.static(publicDirectory));
app.use('/uploads', express.static(uploadsDirectory, { fallthrough: false }));

app.use('/api/auth', authRoutes);
app.use('/api/users', userRoutes);
app.use('/api/posts', postRoutes);
app.use('/api/comments', commentRoutes);

app.use('/api', (_req, res) => res.status(404).json({ message: 'API endpoint not found' }));

app.use((error, _req, res, _next) => {
  if (error.code === 11000) {
    return res.status(400).json({ message: 'That email or username is already in use' });
  }
  if (error.name === 'MulterError') {
    if (error.code === 'LIMIT_FILE_SIZE') {
      return res.status(400).json({ message: 'File is too large. Images may be 5 MB and videos may be 25 MB.' });
    }
    return res.status(400).json({ message: `Upload failed: ${error.message}` });
  }
  if (error.status === 400 && error.message) {
    return res.status(400).json({ message: error.message });
  }
  if (error.status === 404) {
    return res.status(404).json({ message: 'Uploaded file not found' });
  }
  if (error.name === 'ValidationError') {
    const message = Object.values(error.errors).map((item) => item.message).join(', ');
    return res.status(400).json({ message });
  }
  if (error instanceof SyntaxError && error.status === 400 && 'body' in error) {
    return res.status(400).json({ message: 'Invalid JSON request body' });
  }
  console.error(error);
  return res.status(500).json({ message: 'An unexpected server error occurred' });
});

const startServer = async () => {
  if (!process.env.JWT_SECRET || process.env.JWT_SECRET === 'your_secure_jwt_secret') {
    throw new Error('JWT_SECRET is not configured. Add a secure value to .env.');
  }
  await connectDatabase();
  app.listen(port, () => console.log(`Server running at http://localhost:${port}`));
};

startServer().catch((error) => {
  console.error(`Failed to start server: ${error.message}`);
  process.exit(1);
});
