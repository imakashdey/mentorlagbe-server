import { Router } from "express";
import { ObjectId } from "mongodb";

export function reviewsRoutes(db, { verifyToken, verifyStudent }) {
  const router = Router();
  const reviews = db.collection("reviews");
  const applications = db.collection("applications");
  const tuitions = db.collection("tuitions");

  // GET /reviews/tuition/:tuitionId - Public: Fetch all reviews for a tuition
  router.get("/tuition/:tuitionId", async (req, res) => {
    try {
      const { tuitionId } = req.params;
      const queryList = [
        { tuitionId: String(tuitionId) },
      ];
      if (ObjectId.isValid(tuitionId)) {
        queryList.push({ tuitionId: new ObjectId(tuitionId) });
      }

      const list = await reviews
        .find({ $or: queryList })
        .sort({ createdAt: -1 })
        .toArray();

      const totalReviews = list.length;
      const sum = list.reduce((acc, r) => acc + (Number(r.rating) || 5), 0);
      const averageRating = totalReviews > 0 ? Number((sum / totalReviews).toFixed(1)) : 0;

      res.send({
        reviews: list,
        averageRating,
        totalReviews,
      });
    } catch (err) {
      console.error("Fetch reviews error:", err);
      res.status(500).send({ message: "Failed to fetch reviews" });
    }
  });

  // GET /reviews/eligibility/:tuitionId - Protected (Student): Check if student can review
  router.get("/eligibility/:tuitionId", verifyToken, verifyStudent, async (req, res) => {
    try {
      const { tuitionId } = req.params;
      const email = req.user.email;

      const queryList = [
        { tuitionId: String(tuitionId) },
      ];
      if (ObjectId.isValid(tuitionId)) {
        queryList.push({ tuitionId: new ObjectId(tuitionId) });
      }

      // Check if student has an accepted application for this tuition
      const acceptedApp = await applications.findOne({
        $or: queryList,
        studentEmail: email,
        status: "accepted",
      });

      // Check if student has already reviewed this tuition
      const existingReview = await reviews.findOne({
        $or: queryList,
        studentEmail: email,
      });

      res.send({
        eligible: Boolean(acceptedApp),
        alreadyReviewed: Boolean(existingReview),
        existingReview: existingReview || null,
      });
    } catch (err) {
      console.error("Eligibility check error:", err);
      res.status(500).send({ message: "Failed to check review eligibility" });
    }
  });

  // POST /reviews - Protected (Student): Submit or update a 1-5 star review
  router.post("/", verifyToken, verifyStudent, async (req, res) => {
    try {
      const { tuitionId, rating, comment } = req.body;

      if (!tuitionId) {
        return res.status(400).send({ message: "Tuition ID is required" });
      }

      const numRating = Number(rating);
      if (!numRating || numRating < 1 || numRating > 5) {
        return res.status(400).send({ message: "Rating must be between 1 and 5 stars" });
      }

      if (!comment || typeof comment !== "string" || !comment.trim()) {
        return res.status(400).send({ message: "Please provide a review feedback message" });
      }

      const email = req.user.email;
      const studentName = req.user.name || "Student";
      const studentImage = req.user.image || null;

      const queryList = [
        { tuitionId: String(tuitionId) },
      ];
      if (ObjectId.isValid(tuitionId)) {
        queryList.push({ tuitionId: new ObjectId(tuitionId) });
      }

      // Requirement: "Allow students whose application status is 'accepted' to submit a 1–5 star rating and feedback"
      const acceptedApp = await applications.findOne({
        $or: queryList,
        studentEmail: email,
        status: "accepted",
      });

      if (!acceptedApp) {
        return res.status(403).send({
          message: "Only students with an accepted application can submit a review for this tuition.",
        });
      }

      // Fetch tuition title
      let tuitionDoc = null;
      if (ObjectId.isValid(tuitionId)) {
        tuitionDoc = await tuitions.findOne({ _id: new ObjectId(tuitionId) });
      }

      const filter = {
        tuitionId: String(tuitionId),
        studentEmail: email,
      };

      const now = new Date();
      const updateDoc = {
        $set: {
          tuitionId: String(tuitionId),
          tuitionTitle: tuitionDoc?.title || acceptedApp.tuitionTitle || "Tuition",
          studentEmail: email,
          studentName,
          studentImage,
          rating: numRating,
          comment: comment.trim(),
          updatedAt: now,
        },
        $setOnInsert: {
          createdAt: now,
        },
      };

      const result = await reviews.findOneAndUpdate(filter, updateDoc, {
        upsert: true,
        returnDocument: "after",
      });

      // Also update the application with rating and feedback
      await applications.updateOne(
        { _id: acceptedApp._id },
        {
          $set: {
            rating: numRating,
            feedback: comment.trim(),
            reviewedAt: now,
          },
        }
      );

      res.status(200).send({
        message: "Review submitted successfully!",
        review: result.value || result,
      });
    } catch (err) {
      console.error("Submit review error:", err);
      res.status(500).send({ message: "Failed to submit review" });
    }
  });

  return router;
}
