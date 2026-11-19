import { Router } from "express";
import Stripe from "stripe";

export function paymentsRoutes(db, { verifyToken }) {
  const router = Router();
  const users = db.collection("users");
  const payments = db.collection("payments");

  const stripe = new Stripe(process.env.STRIPE_SECRET_KEY);

  const PLANS = {
    tutor: { name: "Pro Tutor Plan", amount: 15 },
    student: { name: "Pro Student Plan", amount: 10 },
  };

  router.post("/create-checkout-session", verifyToken, async (req, res) => {
    try {
      const user = await users.findOne({ email: req.decoded.email });
      if (!user) return res.status(404).send({ message: "User not found" });

      const plan = PLANS[user.role];
      if (!plan) {
        return res.status(403).send({ message: "Only students and tutors can buy a Pro plan" });
      }
      if (user.plan === "pro") {
        return res.status(400).send({ message: "You are already on the Pro plan" });
      }

      const session = await stripe.checkout.sessions.create({
        mode: "payment",
        customer_email: user.email,
        line_items: [
          {
            quantity: 1,
            price_data: {
              currency: "usd",
              unit_amount: plan.amount * 100,
              product_data: { name: plan.name },
            },
          },
        ],
        metadata: { userEmail: user.email, planName: plan.name },
        success_url: `${process.env.CLIENT_URL}/payment/success?session_id={CHECKOUT_SESSION_ID}`,
        cancel_url: `${process.env.CLIENT_URL}/payment/cancel`,
      });

      res.send({ url: session.url });
    } catch (err) {
      res.status(500).send({ message: "Failed to create checkout session" });
    }
  });

  router.get("/verify-session", verifyToken, async (req, res) => {
    try {
      const { session_id } = req.query;
      if (!session_id) return res.status(400).send({ message: "session_id is required" });

      const session = await stripe.checkout.sessions.retrieve(session_id);

      if (session.payment_status !== "paid") {
        return res.status(400).send({ message: "Payment not completed" });
      }
      if (session.metadata?.userEmail !== req.decoded.email) {
        return res.status(403).send({ message: "This payment does not belong to you" });
      }

      const existing = await payments.findOne({ stripeSessionId: session.id });
      if (existing) {
        return res.send({ message: "Payment already recorded", payment: existing });
      }

      const user = await users.findOne({ email: req.decoded.email });

      const payment = {
        userEmail: user.email,
        userName: user.name,
        userRole: user.role,
        planName: session.metadata.planName,
        amount: session.amount_total / 100,
        currency: session.currency,
        transactionId: session.payment_intent,
        stripeSessionId: session.id,
        paymentStatus: "paid",
        paidAt: new Date(),
      };

      try {
        await payments.insertOne(payment);
      } catch (err) {
        if (err.code === 11000) {
          return res.send({ message: "Payment already recorded" });
        }
        throw err;
      }

      await users.updateOne({ email: user.email }, { $set: { plan: "pro" } });

      res.send({ message: "Payment successful. You are now a Pro member!", payment });
    } catch (err) {
      res.status(500).send({ message: "Failed to verify payment" });
    }
  });

  router.get("/my", verifyToken, async (req, res) => {
    try {
      const data = await payments
        .find({ userEmail: req.decoded.email })
        .sort({ paidAt: -1 })
        .toArray();
      res.send(data);
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch payments" });
    }
  });

  return router;
}