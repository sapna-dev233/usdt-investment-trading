import express from 'express';
import { createServer as createViteServer } from 'vite';
import path from 'path';
import cors from 'cors';
import axios from 'axios';
import admin from 'firebase-admin';
import firebaseConfig from './firebase-applet-config.json' assert { type: 'json' };

// Initialize Firebase Admin
admin.initializeApp({
  projectId: firebaseConfig.projectId,
});

// Use the specific database ID from config for Firebase Enterprise editions
const db = firebaseConfig.firestoreDatabaseId 
  ? admin.firestore(firebaseConfig.firestoreDatabaseId)
  : admin.firestore();

// Helper for USDT contract
const USDT_CONTRACT = "0x55d398326f99059ff775485246999027b3197955";

async function startServer() {
  const app = express();
  app.use(cors());
  app.use(express.json());

  // API Routes
  app.get('/api/health', (req, res) => {
    res.json({ status: 'ok' });
  });

  // Admin: Approve Withdrawal
  app.post('/api/admin/approve-withdrawal', async (req, res) => {
    const { withdrawalId, adminEmail } = req.body;
    if (adminEmail !== process.env.ADMIN_EMAIL) return res.status(403).send("Forbidden");

    try {
      const wRef = db.collection('withdrawals').doc(withdrawalId);
      await wRef.update({ status: 'approved' });
      res.send("Approved");
    } catch (err) {
      res.status(500).send(err instanceof Error ? err.message : String(err));
    }
  });

  // Admin: Reject Withdrawal
  app.post('/api/admin/reject-withdrawal', async (req, res) => {
    const { withdrawalId, adminEmail } = req.body;
    if (adminEmail !== process.env.ADMIN_EMAIL) return res.status(403).send("Forbidden");

    try {
      const wRef = db.collection('withdrawals').doc(withdrawalId);
      const wDoc = await wRef.get();
      if (!wDoc.exists) return res.status(404).send("Not found");
      
      const wData = wDoc.data();
      const userRef = db.collection('users').where('email', '==', wData?.userEmail).limit(1);
      const userSnap = await userRef.get();
      
      if (!userSnap.empty) {
        const userDoc = userSnap.docs[0];
        await userDoc.ref.update({
          balance: admin.firestore.FieldValue.increment(wData?.amount || 0)
        });
      }

      await wRef.update({ status: 'rejected' });
      res.send("Rejected");
    } catch (err) {
      res.status(500).send(err instanceof Error ? err.message : String(err));
    }
  });

  // Background Workers
  
  // 1. Profit Distribution (Every 24 hours - simulated here more frequently for demo balance updates if needed, 
  // but we'll stick to 24h as requested)
  setInterval(async () => {
    console.log("Running Daily Profit Distribution...");
    try {
      const investments = await db.collection('investments').where('status', '==', 'active').get();
      const now = new Date();

      for (const doc of investments.docs) {
        const inv = doc.data();
        const lastPaid = inv.lastPaid.toDate();
        const diffDays = Math.floor((now.getTime() - lastPaid.getTime()) / (1000 * 60 * 60 * 24));

        if (diffDays > 0) {
          const profit = (inv.amount * inv.dailyProfit / 100) * diffDays;
          
          // Update User balance
          const userSnap = await db.collection('users').where('email', '==', inv.userEmail).limit(1).get();
          if (!userSnap.empty) {
            const userDoc = userSnap.docs[0];
            await userDoc.ref.update({
              balance: admin.firestore.FieldValue.increment(profit),
              totalEarned: admin.firestore.FieldValue.increment(profit)
            });
          }

          // Update Investment
          await doc.ref.update({
            totalEarned: admin.firestore.FieldValue.increment(profit),
            lastPaid: admin.firestore.Timestamp.fromDate(now)
          });
          
          console.log(`Profit distributed: ${profit} to ${inv.userEmail}`);
        }
      }
    } catch (err) {
      console.error("Profit distribution error:", err);
    }
  }, 1000 * 60 * 60 * 24);

  // 2. Deposit Detector (Every 30 seconds)
  setInterval(async () => {
    const apiKey = process.env.BSCSCAN_API;
    const wallet = process.env.WALLET_ADDRESS;
    if (!apiKey || !wallet) return;

    try {
      const url = `https://api.bscscan.com/api?module=account&action=tokentx&contractaddress=${USDT_CONTRACT}&address=${wallet}&apikey=${apiKey}&sort=desc`;
      const response = await axios.get(url);
      
      if (response.data.status === "1") {
        for (const tx of response.data.result) {
          if (tx.to.toLowerCase() !== wallet.toLowerCase()) continue;

          const depositRef = db.collection('deposits').doc(tx.hash);
          const exists = await depositRef.get();
          if (exists.exists) continue;

          // Find user by wallet address (case insensitive)
          const usersSnap = await db.collection('users').get();
          let matchedUser = null;
          usersSnap.forEach(u => {
            const data = u.data();
            if (data.wallet && data.wallet.toLowerCase() === tx.from.toLowerCase()) {
              matchedUser = { id: u.id, ...data };
            }
          });

          if (matchedUser) {
            const amount = Number(tx.value) / 1e18;
            
            // Record deposit
            await depositRef.set({
              txnHash: tx.hash,
              userEmail: matchedUser.email,
              amount: amount,
              fromAddress: tx.from,
              timestamp: admin.firestore.Timestamp.fromDate(new Date(parseInt(tx.timeStamp) * 1000))
            });

            // Update user balance
            await db.collection('users').doc(matchedUser.id).update({
              balance: admin.firestore.FieldValue.increment(amount)
            });
            
            console.log(`Verified deposit: ${amount} USDT for ${matchedUser.email}`);
          }
        }
      }
    } catch (err) {
      console.error("Deposit detector error:", err);
    }
  }, 30000);

  // Vite Integration
  if (process.env.NODE_ENV !== 'production') {
    const vite = await createViteServer({
      server: { middlewareMode: true },
      appType: 'spa',
    });
    app.use(vite.middlewares);
  } else {
    const distPath = path.join(process.cwd(), 'dist');
    app.use(express.static(distPath));
    app.get('*', (req, res) => {
      res.sendFile(path.join(distPath, 'index.html'));
    });
  }

  const PORT = 3000;
  app.listen(PORT, '0.0.0.0', () => {
    console.log(`Server running on http://localhost:${PORT}`);
  });
}

startServer();
