import { betterAuth } from "better-auth";
import { mongodbAdapter } from "@better-auth/mongo-adapter";

export function createAuth(db, client) {
  if (!process.env.BETTER_AUTH_SECRET) {
    throw new Error("BETTER_AUTH_SECRET is missing from .env");
  }

  const isProd = process.env.NODE_ENV === "production";

  return betterAuth({
    database: mongodbAdapter(db, { client }),
    baseURL: process.env.BETTER_AUTH_URL || "http://localhost:5000",
    secret: process.env.BETTER_AUTH_SECRET,
    trustedOrigins: [process.env.CLIENT_URL || "http://localhost:3000"],

    // requirement অনুযায়ী collection নাম "users"
    user: {
      modelName: "users",
      additionalFields: {
        role: { type: "string", defaultValue: "student", input: true },
        plan: { type: "string", defaultValue: "free", input: false },
        phone: { type: "string", required: false },
        bio: { type: "string", required: false },
      },
    },

    emailAndPassword: { enabled: true, minPasswordLength: 6 },

    // client আর server আলাদা domain এ থাকলে cross-site cookie
    advanced: {
      defaultCookieAttributes: {
        sameSite: isProd ? "none" : "lax",
        secure: isProd,
      },
    },

    databaseHooks: {
      user: {
        create: {
          // 🔒 sign-up এ শুধু student/tutor, plan সবসময় free
          before: async (user) => {
            const role = ["student", "tutor"].includes(user.role)
              ? user.role
              : "student";
            return { data: { ...user, role, plan: "free" } };
          },
        },
        update: {
          // 🔒 client থেকে role/plan বদলানো যাবে না (false = operation বাতিল)
          before: async (data) => {
            if (data.role !== undefined || data.plan !== undefined) return false;
            return { data };
          },
        },
      },
    },
  });
}