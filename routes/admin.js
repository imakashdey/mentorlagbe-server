import { Router } from "express";
import { ObjectId } from "mongodb";

export function adminRoutes(db, { verifyToken, verifyAdmin }) {
  const router = Router();
  const users = db.collection("users");
  const tuitions = db.collection("tuitions");
  const payments = db.collection("payments");

  router.use(verifyToken, verifyAdmin);

  router.get("/stats", async (req, res) => {
    try {
      const [totalUsers, totalTutors, totalStudents, pending, approved, rejected, revenue] =
        await Promise.all([
          users.countDocuments(),
          users.countDocuments({ role: "tutor" }),
          users.countDocuments({ role: "student" }),
          tuitions.countDocuments({ approvalStatus: "pending" }),
          tuitions.countDocuments({ approvalStatus: "approved" }),
          tuitions.countDocuments({ approvalStatus: "rejected" }),
          payments
            .aggregate([{ $group: { _id: null, total: { $sum: "$amount" } } }])
            .toArray(),
        ]);

      res.send({
        totalUsers,
        totalTutors,
        totalStudents,
        pendingTuitions: pending,
        approvedTuitions: approved,
        rejectedTuitions: rejected,
        totalRevenue: revenue[0]?.total || 0,
      });
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch stats" });
    }
  });

  router.get("/users", async (req, res) => {
    try {
      const data = await users
        .find({}, { projection: { name: 1, email: 1, image: 1, role: 1, plan: 1, phone: 1, createdAt: 1 } })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(data);
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch users" });
    }
  });

  router.patch("/users/:id/role", async (req, res) => {
    try {
      const { role } = req.body;
      if (!["student", "tutor", "admin"].includes(role)) {
        return res.status(400).send({ message: "Invalid role" });
      }
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid user id" });
      }
      if (String(req.user._id) === req.params.id) {
        return res.status(400).send({ message: "You cannot change your own role" });
      }
      const result = await users.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { role } }
      );
      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "User not found" });
      }
      res.send({ message: `Role updated to ${role}` });
    } catch (err) {
      res.status(500).send({ message: "Failed to update role" });
    }
  });

  router.get("/tuitions", async (req, res) => {
    try {
      const data = await tuitions.find().sort({ createdAt: -1 }).toArray();
      res.send(data);
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch tuitions" });
    }
  });

  router.patch("/tuitions/:id/approval", async (req, res) => {
    try {
      const { approvalStatus } = req.body;
      if (!["approved", "rejected"].includes(approvalStatus)) {
        return res.status(400).send({ message: "Status must be approved or rejected" });
      }
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid tuition id" });
      }
      const result = await tuitions.updateOne(
        { _id: new ObjectId(req.params.id) },
        { $set: { approvalStatus } }
      );
      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "Tuition not found" });
      }
      res.send({ message: `Tuition ${approvalStatus}` });
    } catch (err) {
      res.status(500).send({ message: "Failed to update approval status" });
    }
  });

  router.get("/transactions", async (req, res) => {
    try {
      const data = await payments.find().sort({ paidAt: -1 }).toArray();
      res.send(data);
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch transactions" });
    }
  });

  return router;
}