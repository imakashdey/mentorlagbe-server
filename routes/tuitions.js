import { Router } from "express";
import { ObjectId } from "mongodb";

export function tuitionsRoutes(db, { verifyToken, verifyTutor }) {
  const router = Router();
  const tuitions = db.collection("tuitions");

  const publicFilter = { approvalStatus: "approved", isActive: true };
  const FREE_PLAN_LIMIT = 2;

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

  const pickFields = (body) => ({
    title: body.title?.trim(),
    subject: body.subject?.trim(),
    classLevel: body.classLevel?.trim(),
    mode: body.mode,
    location: body.location?.trim(),
    monthlyFee: Number(body.monthlyFee),
    daysPerWeek: Number(body.daysPerWeek),
    bannerImage: body.bannerImage?.trim() || "",
    description: body.description?.trim(),
  });

  const validate = (f) => {
    if (!f.title || !f.subject || !f.classLevel || !f.location || !f.description) {
      return "Title, subject, class level, location and description are required";
    }
    if (!["Online", "Offline"].includes(f.mode)) return "Mode must be Online or Offline";
    if (!(f.monthlyFee > 0)) return "Monthly fee must be greater than 0";
    if (!(f.daysPerWeek >= 1 && f.daysPerWeek <= 7)) {
      return "Days per week must be between 1 and 7";
    }
    return null;
  };

  router.get("/", async (req, res) => {
    try {
      const { search, subject, classLevel, mode } = req.query;
      const page = Math.max(parseInt(req.query.page) || 1, 1);
      const limit = Math.min(Math.max(parseInt(req.query.limit) || 9, 1), 50);

      const query = { ...publicFilter };

      if (search?.trim()) {
        const regex = new RegExp(escapeRegex(search.trim()), "i");
        query.$or = [{ title: regex }, { subject: regex }];
      }
      if (subject) query.subject = subject;
      if (classLevel) query.classLevel = classLevel;
      if (mode && ["Online", "Offline"].includes(mode)) query.mode = mode;

      const total = await tuitions.countDocuments(query);
      const data = await tuitions
        .find(query)
        .sort({ createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .toArray();

      res.send({
        data,
        total,
        page,
        limit,
        totalPages: Math.ceil(total / limit),
      });
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch tuitions" });
    }
  });

  router.get("/latest", async (req, res) => {
    try {
      const data = await tuitions
        .find(publicFilter)
        .sort({ createdAt: -1 })
        .limit(6)
        .toArray();
      res.send(data);
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch latest tuitions" });
    }
  });

  router.get("/filters", async (req, res) => {
    try {
      const subjects = await tuitions.distinct("subject", publicFilter);
      const classLevels = await tuitions.distinct("classLevel", publicFilter);
      res.send({ subjects: subjects.sort(), classLevels: classLevels.sort() });
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch filters" });
    }
  });

  router.get("/mine", verifyToken, verifyTutor, async (req, res) => {
    try {
      const data = await tuitions
        .find({ tutorEmail: req.user.email })
        .sort({ createdAt: -1 })
        .toArray();
      res.send(data);
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch your tuitions" });
    }
  });

  router.post("/", verifyToken, verifyTutor, async (req, res) => {
    try {
      const fields = pickFields(req.body);
      const error = validate(fields);
      if (error) return res.status(400).send({ message: error });

      if (req.user.plan !== "pro") {
        const count = await tuitions.countDocuments({ tutorEmail: req.user.email });
        if (count >= FREE_PLAN_LIMIT) {
          return res.status(403).send({
            message: "Free plan allows up to 2 tuition posts. Upgrade to Pro for unlimited posts.",
          });
        }
      }

      const doc = {
        ...fields,
        tutorName: req.user.name,
        tutorEmail: req.user.email,
        approvalStatus: "pending",
        isActive: true,
        createdAt: new Date(),
      };
      const result = await tuitions.insertOne(doc);
      res.status(201).send({ ...doc, _id: result.insertedId });
    } catch (err) {
      res.status(500).send({ message: "Failed to create tuition" });
    }
  });

  router.get("/:id", async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid tuition id" });
      }
      const tuition = await tuitions.findOne({
        _id: new ObjectId(req.params.id),
        ...publicFilter,
      });
      if (!tuition) return res.status(404).send({ message: "Tuition not found" });

      const tutor = await db.collection("users").findOne(
        { email: tuition.tutorEmail },
        { projection: { name: 1, email: 1, image: 1, bio: 1, phone: 1, plan: 1 } }
      );

      res.send({ ...tuition, tutor });
    } catch (err) {
      res.status(500).send({ message: "Failed to fetch tuition" });
    }
  });

  router.put("/:id", verifyToken, verifyTutor, async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid tuition id" });
      }
      const fields = pickFields(req.body);
      const error = validate(fields);
      if (error) return res.status(400).send({ message: error });

      const result = await tuitions.updateOne(
        { _id: new ObjectId(req.params.id), tutorEmail: req.user.email },
        { $set: fields }
      );
      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "Tuition not found" });
      }
      res.send({ message: "Tuition updated" });
    } catch (err) {
      res.status(500).send({ message: "Failed to update tuition" });
    }
  });

  router.patch("/:id/active", verifyToken, verifyTutor, async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid tuition id" });
      }
      const { isActive } = req.body;
      if (typeof isActive !== "boolean") {
        return res.status(400).send({ message: "isActive must be true or false" });
      }
      const result = await tuitions.updateOne(
        { _id: new ObjectId(req.params.id), tutorEmail: req.user.email },
        { $set: { isActive } }
      );
      if (result.matchedCount === 0) {
        return res.status(404).send({ message: "Tuition not found" });
      }
      res.send({ message: isActive ? "Tuition is now active" : "Tuition closed" });
    } catch (err) {
      res.status(500).send({ message: "Failed to update status" });
    }
  });

  router.delete("/:id", verifyToken, verifyTutor, async (req, res) => {
    try {
      if (!ObjectId.isValid(req.params.id)) {
        return res.status(400).send({ message: "Invalid tuition id" });
      }
      const result = await tuitions.deleteOne({
        _id: new ObjectId(req.params.id),
        tutorEmail: req.user.email,
      });
      if (result.deletedCount === 0) {
        return res.status(404).send({ message: "Tuition not found" });
      }
      res.send({ message: "Tuition deleted" });
    } catch (err) {
      res.status(500).send({ message: "Failed to delete tuition" });
    }
  });

  return router;
}