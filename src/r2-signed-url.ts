import { S3Client, GetObjectCommand, HeadObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

const s3Client = new S3Client({
  region: 'auto',
  endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID || '',
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY || '',
  },
});

const BUCKET_NAME = process.env.R2_BUCKET_NAME || '';
const EXPIRATION_SECONDS = 86400; // 1 day

export async function checkFileExists(folder: string): Promise<boolean> {
  const key = `${folder}/SKILL.md`;
  try {
    await s3Client.send(new HeadObjectCommand({ Bucket: BUCKET_NAME, Key: key }));
    return true;
  } catch (error: any) {
    if (error.name === 'NotFound' || error.$metadata?.httpStatusCode === 404) {
      return false;
    }
    throw error;
  }
}

export async function generateSignedUrl(folder: string): Promise<string> {
  const key = `${folder}/SKILL.md`;
  const command = new GetObjectCommand({ Bucket: BUCKET_NAME, Key: key });

  const signedUrl = await getSignedUrl(s3Client, command, {
    expiresIn: EXPIRATION_SECONDS,
  });

  return signedUrl;
}
