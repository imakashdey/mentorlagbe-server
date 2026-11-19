import "dotenv/config";
import express from "express";
import cors from "cors";
import jwt from "jsonwebtoken";
import { MongoClient, ServerApiVersion } from "mongodb";
import { toNodeHandler, fromNodeHeaders } from "better-auth/node";
import { createAuth } from "./config/auth.js";
import { createMiddlewares } from "./middlewares/index.js";

const app = express();
const port = process.env.PORT || 5000;

app.use(
  cors({
    origin: process.env.CLIENT_URL || "http://localhost:3000",
    credentials: true,
  })
);

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: {
    version: ServerApiVersion.v1,
    strict: true,
    deprecationErrors: true,
  },
});

// Top-level await: Vercel এও কাজ করবে
await client.connect();
const db = client.db("mentorlagbe");

const usersCollection = db.collection("users");
const tuitionsCollection = db.collection("tuitions");
const applicationsCollection = db.collection("applications");
const paymentsCollection = db.collection("payments");

await usersCollection.createIndex({ email: 1 }, { unique: true });
await applicationsCollection.createIndex(
  { tuitionId: 1, studentEmail: 1 },
  { unique: true }
);

const auth = createAuth(db, client);
const { verifyToken, verifyStudent, verifyTutor, verifyAdmin } =
  createMiddlewares(db);

// 1) BetterAuth (অবশ্যই express.json() এর আগে)
app.all("/api/auth/{*any}", toNodeHandler(auth));

// 2) Body parser
app.use(express.json());

// 3) JWT issue: session cookie থেকে user চিনে token দেয়
app.post("/api/jwt", async (req, res) => {
  const session = await auth.api.getSession({
    headers: fromNodeHeaders(req.headers),
  });
  if (!session) return res.status(401).send({ message: "Unauthorized" });

  const { email, role } = session.user;
  const token = jwt.sign({ email, role }, process.env.JWT_SECRET, {
    expiresIn: "7d",
  });
  res.send({ token });
});

// 4) Routes
app.get("/", (req, res) => res.send("MentorLagbe server is running"));

app.get("/tuitions", async (req, res) => {
  const result = await tuitionsCollection
    .find({ approvalStatus: "approved", isActive: true })
    .toArray();
  res.send(result);
});

// Token ঠিকমতো কাজ করছে কিনা test করার জন্য (পরে ফেলে দিতে পারো)
app.get("/me", verifyToken, async (req, res) => {
  const user = await usersCollection.findOne({ email: req.decoded.email });
  res.send(user);
});

export default app; // Vercel এর জন্য

if (!process.env.VERCEL) {
  app.listen(port, () => console.log(`Server running on port ${port}`));
}