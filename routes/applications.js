  // PATCH /applications/:id/review: শুধু accepted application-এ নিজের রিভিউ
  router.patch("/:id/review", verifyToken, verifyStudent, async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid application id" });
      }
      const rating = Number(req.body.rating);
      const feedback = req.body.feedback?.trim() || "";

      if (!Number.isInteger(rating) || rating < 1 || rating > 5) {
        return res.status(400).send({ message: "Rating must be between 1 and 5" });
      }
      if (feedback.length < 10 || feedback.length > 500) {
        return res
          .status(400)
          .send({ message: "Feedback must be 10 to 500 characters" });
      }

      const result = await applications.updateOne(
        {
          _id: new ObjectId(req.params.id),
          studentEmail: req.user.email,
          status: "accepted",
        },
        { $set: { rating, feedback, reviewedAt: new Date() } }
      );
      if (result.matchedCount === 0) {
        return res
          .status(400)
          .send({ message: "Only your accepted applications can be reviewed" });
      }
      res.send({ message: "Review submitted" });
    } catch (err) {
      res.status(500).send({ message: "Failed to submit review" });
    }
  });

  // GET /applications/reviews/latest: সবার জন্য খোলা, সর্বশেষ ৬টা আসল রিভিউ
  router.get("/reviews/latest", async (req, res) => {
    try {
      const data = await applications
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
      res.send(data);
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch reviews" });
    }
  });