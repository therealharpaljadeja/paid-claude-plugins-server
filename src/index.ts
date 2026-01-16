import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import { generateSignedUrl, checkFileExists } from './r2-signed-url';

dotenv.config();

const app = express();
const PORT = 3000;

app.use(express.json());

app.get('/get-skill', async (req: Request, res: Response) => {
  const name = req.query.name as string;

  if (!name) {
    res.status(400).json({ error: 'name query parameter is required' });
    return;
  }

  const exists = await checkFileExists(name);
  if (!exists) {
    res.status(404).json({ error: 'File not found in bucket' });
    return;
  }

  const signedUrl = await generateSignedUrl(name);
  res.json({ name, signedUrl });
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
