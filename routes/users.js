import { Router } from "express";

export function usersRoutes(db, { verifyToken, verifyStudent, verifyTutor }) {
  const router = Router();
  const users = db.collection("users");
  const tuitions = db.collection("tuitions");
  const applications = db.collection("applications");

  router.patch("/profile", verifyToken, async (req, res) => {
    try {
      const { name, phone, bio, image } = req.body;
      const update = {};

      if (name !== undefined) {
        if (!name.trim()) return res.status(400).send({ message: "Name cannot be empty" });
        update.name = name.trim();
      }
      if (phone !== undefined) update.phone = phone.trim();
      if (bio !== undefined) update.bio = bio.trim();
      if (image !== undefined) update.image = image.trim();

      if (Object.keys(update).length === 0) {
        return res.status(400).send({ message: "Nothing to update" });
      }

      const result = await users.updateOne({ email: req.decoded.email }, { $set: update });
      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "User not found" });
      }
      const user = await users.findOne({ email: req.decoded.email });
      res.send({ message: "Profile updated", user });
    } catch (err) {
      res.status(500).send({ message: "Failed to update profile" });
    }
  });

  router.get("/stats/student", verifyToken, verifyStudent, async (req, res) => {
    try {
      const email = req.user.email;
      const [total, accepted, pending] = await Promise.all([
        applications.countDocuments({ studentEmail: email }),
        applications.countDocuments({ studentEmail: email, status: "accepted" }),
        applications.countDocuments({ studentEmail: email, status: "pending" }),
      ]);
      res.send({
        totalApplied: total,
        accepted,
        pending,
        plan: req.user.plan || "free",
      });
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch stats" });
    }
  });

  router.get("/stats/tutor", verifyToken, verifyTutor, async (req, res) => {
    try {
      const email = req.user.email;
      const [totalTuitions, activeApproved, totalApplicants] = await Promise.all([
        tuitions.countDocuments({ tutorEmail: email }),
        tuitions.countDocuments({ tutorEmail: email, approvalStatus: "approved", isActive: true }),
        applications.countDocuments({ tutorEmail: email }),
      ]);
      res.send({
        totalTuitions,
        activeApproved,
        totalApplicants,
        plan: req.user.plan || "free",
      });
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch stats" });
    }
  });

  return router;
}