import jwt from "jsonwebtoken";

export function createMiddlewares(db) {
  const verifyToken = (req, res, next) => {
    const header = req.headers.authorization;
    if (!header?.startsWith("Bearer ")) {
      return res.status(401).send({ message: "Unauthorized access" });
    }
    jwt.verify(header.split(" ")[1], process.env.JWT_SECRET, (err, decoded) => {
      if (err) return res.status(401).send({ message: "Invalid or expired token" });
      req.decoded = decoded;
      next();
    });
  };

  // role সবসময় DB থেকে চেক হয়, তাই role বদলালে সাথে সাথে কাজ করে
  const verifyRole = (role) => async (req, res, next) => {
    const user = await db.collection("users").findOne({ email: req.decoded.email });
    if (!user || user.role !== role) {
      return res.status(403).send({ message: "Forbidden access" });
    }
    req.user = user;
    next();
  };

  return {
    verifyToken,
    verifyStudent: verifyRole("student"),
    verifyTutor: verifyRole("tutor"),
    verifyAdmin: verifyRole("admin"),
  };
}