import { Router } from "express";
import { ObjectId } from "mongodb";

export function tuitionsRoutes(db) {
  const router = Router();
  const tuitions = db.collection("tuitions");

 
  const publicFilter = { approvalStatus: "approved", isActive: true };

  const escapeRegex = (s) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");


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

  return router;
}