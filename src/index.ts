import express, { Request, Response } from 'express';
import dotenv from 'dotenv';
import axios from 'axios';
import { generateSignedUrl, checkFileExists } from './r2-signed-url';

dotenv.config();

const app = express();
const PORT = 3000;

const FACILITATOR_URL = 'https://facilitator.cronoslabs.org/v2/x402';
const SELLER_WALLET = process.env.SELLER_WALLET || '';
const USDCE_CONTRACT = '0xc01efAaF7C5C61bEbFAeb358E1161b537b8bC0e0';
const NETWORK = process.env.CRONOS_NETWORK || 'cronos-testnet';
const PAYMENT_AMOUNT = process.env.PAYMENT_AMOUNT || '1000000'; // Default 1 USDC (6 decimals)

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

  const paymentHeader = req.headers['x-payment'] as string || req.body?.paymentHeader;

  const paymentRequirements = {
    scheme: 'exact',
    network: NETWORK,
    payTo: SELLER_WALLET,
    asset: USDCE_CONTRACT,
    description: `Access to skill: ${name}`,
    mimeType: 'application/json',
    maxAmountRequired: PAYMENT_AMOUNT,
    maxTimeoutSeconds: 300
  };

  if (!paymentHeader) {
    res.status(402).json({
      error: 'Payment Required Response',
      x402Version: 1,
      accepts: [paymentRequirements]
    });
    return;
  }

  try {
    const requestBody = {
      x402Version: 1,
      paymentHeader: paymentHeader,
      paymentRequirements
    };

    const verifyRes = await axios.post(`${FACILITATOR_URL}/verify`, requestBody, {
      headers: { 'Content-Type': 'application/json', 'X402-Version': '1' }
    });

    if (!verifyRes.data.isValid) {
      res.status(402).json({
        error: 'Invalid payment',
        reason: verifyRes.data.invalidReason
      });
      return;
    }

    const settleRes = await axios.post(`${FACILITATOR_URL}/settle`, requestBody, {
      headers: { 'Content-Type': 'application/json', 'X402-Version': '1' }
    });

    if (settleRes.data.event === 'payment.settled') {
      const signedUrl = await generateSignedUrl(name);
      res.status(200).json({
        name,
        signedUrl,
        payment: {
          txHash: settleRes.data.txHash,
          from: settleRes.data.from,
          to: settleRes.data.to,
          value: settleRes.data.value,
          blockNumber: settleRes.data.blockNumber,
          timestamp: settleRes.data.timestamp
        }
      });
    } else {
      res.status(402).json({
        error: 'Payment settlement failed',
        reason: settleRes.data.error
      });
    }
  } catch (error: any) {
    res.status(500).json({
      error: 'Server error processing payment',
      details: error.response?.data || error.message
    });
  }
});

app.listen(PORT, () => {
  console.log(`Server is running on http://localhost:${PORT}`);
});
