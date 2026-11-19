import { Router } from "express";
import { ObjectId } from "mongodb";

export function applicationsRoutes(db, { verifyToken, verifyStudent, verifyTutor }) {
  const router = Router();
  const applications = db.collection("applications");
  const tuitions = db.collection("tuitions");

  // POST /applications: শুধু Student apply করতে পারবে
  router.post("/", verifyToken, verifyStudent, async (req, res) => {
    try {
      const { tuitionId, studentPhone, preferredSchedule, studentNote } = req.body;

      if (!ObjectId.isValid(tuitionId)) {
        return res.status(400).send({ message: "Invalid tuition id" });
      }
      if (!studentPhone?.trim() || !preferredSchedule?.trim()) {
        return res.status(400).send({ message: "Phone and preferred schedule are required" });
      }

      // শুধু approved + active tuition এ apply করা যাবে
      const tuition = await tuitions.findOne({
        _id: new ObjectId(tuitionId),
        approvalStatus: "approved",
        isActive: true,
      });
      if (!tuition) return res.status(404).send({ message: "Tuition not found" });

      // Duplicate আটকানো (index এর সাথে এই চেকও আছে, যাতে সুন্দর message যায়)
      const already = await applications.findOne({
        tuitionId: String(tuition._id),
        studentEmail: req.user.email,
      });
      if (already) {
        return res.status(409).send({ message: "You have already applied for this tuition" });
      }

      const doc = {
        tuitionId: String(tuition._id),
        tuitionTitle: tuition.title,
        subject: tuition.subject,
        monthlyFee: tuition.monthlyFee,
        tutorEmail: tuition.tutorEmail,
        studentName: req.user.name,
        studentEmail: req.user.email,
        studentPhone: studentPhone.trim(),
        preferredSchedule: preferredSchedule.trim(),
        studentNote: studentNote?.trim() || "",
        status: "pending",
        appliedAt: new Date(),
      };

      const result = await applications.insertOne(doc);
      res.status(201).send({ ...doc, _id: result.insertedId });
    } catch (err) {
      if (err.code === 11000) {
        return res.status(409).send({ message: "You have already applied for this tuition" });
      }
      res.status(500).send({ message: "Failed to submit application" });
    }
  });

  // GET /applications/my: Student এর নিজের সব application
  router.get("/my", verifyToken, verifyStudent, async (req, res) => {
    try {
      const data = await applications
        .find({ studentEmail: req.user.email })
        .sort({ appliedAt: -1 })
        .toArray();
      res.send(data);
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch applications" });
    }
  });

  // GET /applications/check/:tuitionId: Details page এ "Already applied" দেখানোর জন্য
  router.get("/check/:tuitionId", verifyToken, verifyStudent, async (req, res) => {
    try {
      const found = await applications.findOne({
        tuitionId: req.params.tuitionId,
        studentEmail: req.user.email,
      });
      res.send({ applied: !!found });
    } catch (err) {
      res.status(500).send({ message: "Failed to check application" });
    }
  });

  // DELETE /applications/:id: শুধু নিজের + শুধু pending হলে cancel
  router.delete("/:id", verifyToken, verifyStudent, async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid application id" });
      }
      const result = await applications.deleteOne({
        _id: new ObjectId(req.params.id),
        studentEmail: req.user.email,
        status: "pending",
      });
      if (result.deletedCount === 0) {
        return res.status(400).send({ message: "Only your pending applications can be cancelled" });
      }
      res.send({ message: "Application cancelled" });
    } catch (err) {
      res.status(500).send({ message: "Failed to cancel application" });
    }
  });

  // GET /applications/tutor: Tutor এর নিজের tuition এর সব applicant
  router.get("/tutor", verifyToken, verifyTutor, async (req, res) => {
    try {
      const data = await applications
        .find({ tutorEmail: req.user.email })
        .sort({ appliedAt: -1 })
        .toArray();
      res.send(data);
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch applicants" });
    }
  });

  // PATCH /applications/:id/status: Tutor শুধু নিজের tuition এর application বদলাতে পারবে
  router.patch("/:id/status", verifyToken, verifyTutor, async (req, res) => {
    try {
      const { status } = req.body;
      if (!["accepted", "rejected"].includes(status)) {
        return res.status(400).send({ message: "Status must be accepted or rejected" });
      }
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid application id" });
      }
      const result = await applications.updateOne(
        { _id: new ObjectId(req.params.id), tutorEmail: req.user.email },
        { $set: { status } }
      );
      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "Application not found" });
      }
      res.send({ message: `Application ${status}` });
    } catch (err) {
      res.status(500).send({ message: "Failed to update status" });
    }
  });

  return router;
}