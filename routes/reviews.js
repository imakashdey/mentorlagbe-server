import { Router } from "express";
import { ObjectId } from "mongodb";

export function reviewsRoutes(db, { verifyToken, verifyStudent }) {
  const router = Router();
  const applications = db.collection("applications");

  const idMatch = (tuitionId) => String(tuitionId);

  // GET /reviews/tuition/:tuitionId - Public
  router.get("/tuition/:tuitionId", async (req, res) => {
    try {
      const list = await applications
        .find({ tuitionId: idMatch(req.params.tuitionId), rating: { $exists: true } })
        .sort({ reviewedAt: -1 })
        .project({
          studentName: 1,
          tuitionTitle: 1,
          rating: 1,
          feedback: 1,
          reviewedAt: 1,
        })
        .toArray();

      const reviews = list.map((r) => ({
        _id: r._id,
        studentName: r.studentName,
        tuitionTitle: r.tuitionTitle,
        rating: r.rating,
        comment: r.feedback,
        createdAt: r.reviewedAt,
      }));

      const totalReviews = reviews.length;
      const sum = reviews.reduce((acc, r) => acc + Number(r.rating), 0);
      const averageRating =
        totalReviews > 0 ? Number((sum / totalReviews).toFixed(1)) : 0;

      res.send({ reviews, averageRating, totalReviews });
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch reviews" });
    }
  });

  // GET /reviews/latest - Public: home page testimonials
  router.get("/latest", async (req, res) => {
    try {
      const list = await applications
        .find({ rating: { $exists: true } })
        .sort({ reviewedAt: -1 })
        .limit(6)
        .project({
          studentName: 1,
          tuitionTitle: 1,
          subject: 1,
          rating: 1,
          feedback: 1,
          reviewedAt: 1,
        })
        .toArray();
      res.send(list);
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch reviews" });
    }
  });

  // GET /reviews/eligibility/:tuitionId - Student
  router.get("/eligibility/:tuitionId", verifyToken, verifyStudent, async (req, res) => {
    try {
      const app = await applications.findOne({
        tuitionId: idMatch(req.params.tuitionId),
        studentEmail: req.user.email,
        status: "accepted",
      });
      const alreadyReviewed = Boolean(app && app.rating);
      res.send({
        eligible: Boolean(app),
        alreadyReviewed,
        existingReview: alreadyReviewed
          ? { rating: app.rating, comment: app.feedback }
          : null,
      });
    } catch (err) {
      res.status(500).send({ message: "Failed to check review eligibility" });
    }
  });

  // POST /reviews - Student: accepted application-এ review (নতুন বা আপডেট)
  router.post("/", verifyToken, verifyStudent, async (req, res) => {
    try {
      const { tuitionId, rating, comment } = req.body;

      if (!tuitionId) {
        return res.status(400).send({ message: "Tuition ID is required" });
      }
      const numRating = Number(rating);
      if (!Number.isInteger(numRating) || numRating < 1 || numRating > 5) {
        return res.status(400).send({ message: "Rating must be between 1 and 5 stars" });
      }
      const text = typeof comment === "string" ? comment.trim() : "";
      if (text.length < 10 || text.length > 500) {
        return res
          .status(400)
          .send({ message: "Feedback must be 10 to 500 characters" });
      }

      const result = await applications.updateOne(
        {
          tuitionId: idMatch(tuitionId),
          studentEmail: req.user.email,
          status: "accepted",
        },
        { $set: { rating: numRating, feedback: text, reviewedAt: new Date() } }
      );

      if (result.matchedCount === 0) {
        return res.status(403).send({
          message: "Only students with an accepted application can submit a review.",
        });
      }
      res.send({ message: "Review submitted successfully!" });
    } catch (err) {
      res.status(500).send({ message: "Failed to submit review" });
    }
  });

  return router;
}