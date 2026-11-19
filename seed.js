import "dotenv/config";
import { MongoClient, ServerApiVersion } from "mongodb";
import { createAuth } from "./config/auth.js";

const client = new MongoClient(process.env.MONGODB_URI, {
  serverApi: { version: ServerApiVersion.v1, strict: true, deprecationErrors: true },
});
await client.connect();
const db = client.db("mentorlagbe");
const auth = createAuth(db, client);

// 0) পুরোনো test user পরিষ্কার
const testUser = await db.collection("users").findOne({ email: "t@test.com" });
if (testUser) {
  const idVariants = [testUser._id, String(testUser._id)];
  await db.collection("account").deleteMany({ userId: { $in: idVariants } });
  await db.collection("session").deleteMany({ userId: { $in: idVariants } });
  await db.collection("users").deleteOne({ _id: testUser._id });
  console.log("Removed test user t@test.com");
}

// 1) Users (BetterAuth দিয়ে, যাতে password hash হয়)
const users = [
  { name: "MentorLagbe Admin", email: "admin@mentorlagbe.com", password: "Admin@123456", role: "admin", plan: "free", phone: "01800000000", bio: "Platform administrator." },
  { name: "Rahim Uddin", email: "rahim.tutor@mentorlagbe.com", password: "Tutor@123456", role: "tutor", plan: "pro", phone: "01711111111", bio: "Math and science tutor with 8 years of experience." },
  { name: "Nusrat Jahan", email: "nusrat.tutor@mentorlagbe.com", password: "Tutor@123456", role: "tutor", plan: "pro", phone: "01722222222", bio: "Physics and chemistry mentor, BUET graduate." },
  { name: "Tanvir Ahmed", email: "tanvir.tutor@mentorlagbe.com", password: "Tutor@123456", role: "tutor", plan: "pro", phone: "01733333333", bio: "Software engineer teaching programming." },
  { name: "Farhana Akter", email: "farhana.tutor@mentorlagbe.com", password: "Tutor@123456", role: "tutor", plan: "pro", phone: "01744444444", bio: "IELTS 8.0 scorer and English language trainer." },
  // Free tutor: Free plan limit (২টা post) test করার জন্য
  { name: "Imran Hasan", email: "imran.tutor@mentorlagbe.com", password: "Tutor@123456", role: "tutor", plan: "free", phone: "01755555555", bio: "Biology and ICT tutor." },
  { name: "Sabbir Hossain", email: "student1@mentorlagbe.com", password: "Student@123456", role: "student", plan: "free", phone: "01766666666", bio: "HSC candidate looking for good tutors." },
  { name: "Mim Chowdhury", email: "student2@mentorlagbe.com", password: "Student@123456", role: "student", plan: "pro", phone: "01777777777", bio: "Admission candidate preparing for IELTS." },
];

for (const u of users) {
  const exists = await db.collection("users").findOne({ email: u.email });
  if (!exists) {
    await auth.api.signUpEmail({
      body: { name: u.name, email: u.email, password: u.password, role: u.role },
    });
    console.log("Created:", u.email);
  }
  // sign-up hook admin/plan আটকায়, তাই সরাসরি DB তে বসাই
  await db.collection("users").updateOne(
    { email: u.email },
    {
      $set: {
        role: u.role,
        plan: u.plan,
        phone: u.phone,
        bio: u.bio,
        image: `https://i.pravatar.cc/150?u=${u.email}`,
      },
    }
  );
}

// 2) Tuitions
const tutors = {
  rahim: { name: "Rahim Uddin", email: "rahim.tutor@mentorlagbe.com" },
  nusrat: { name: "Nusrat Jahan", email: "nusrat.tutor@mentorlagbe.com" },
  tanvir: { name: "Tanvir Ahmed", email: "tanvir.tutor@mentorlagbe.com" },
  farhana: { name: "Farhana Akter", email: "farhana.tutor@mentorlagbe.com" },
  imran: { name: "Imran Hasan", email: "imran.tutor@mentorlagbe.com" },
};

const raw = [
  ["HSC Higher Math Batch", "Math", "HSC", "Offline", "Dhanmondi, Dhaka", 3000, 4, "rahim", "Complete HSC higher math with weekly exams and doubt-solving sessions."],
  ["SSC General Math Crash Course", "Math", "SSC", "Online", "Online (Zoom)", 1800, 3, "rahim", "Concept-first SSC math course with recorded classes and practice sheets."],
  ["HSC Physics Mastery", "Physics", "HSC", "Online", "Online (Google Meet)", 2500, 3, "nusrat", "Mechanics, waves and modern physics explained with real examples."],
  ["Physics Olympiad Mentorship", "Physics", "Admission", "Online", "Online (Zoom)", 3500, 2, "nusrat", "1-on-1 mentorship for national physics olympiad preparation."],
  ["Web Development with JavaScript", "Programming", "University", "Online", "Online (Zoom)", 4000, 3, "tanvir", "HTML, CSS, JavaScript and React from scratch with real projects."],
  ["Python for Beginners", "Programming", "SSC", "Online", "Online (Google Meet)", 2000, 2, "tanvir", "Learn Python basics, loops, functions and mini games."],
  ["C Programming and Problem Solving", "Programming", "University", "Offline", "Mirpur, Dhaka", 3200, 3, "tanvir", "Problem solving for CSE students with weekly contests."],
  ["IELTS Academic Preparation", "IELTS", "Admission", "Online", "Online (Zoom)", 5000, 4, "farhana", "Band 7+ strategy for all four modules with mock tests."],
  ["IELTS Speaking Intensive", "IELTS", "Admission", "Offline", "Gulshan, Dhaka", 3500, 3, "farhana", "Speaking practice with feedback in small groups."],
  ["Class 8 English Grammar", "English", "Class 8", "Offline", "Uttara, Dhaka", 1500, 3, "farhana", "Grammar, writing and vocabulary building for junior students."],
  ["HSC Chemistry Organic Special", "Chemistry", "HSC", "Offline", "Chattogram, GEC Circle", 2800, 3, "nusrat", "Organic chemistry made simple with reaction maps and quizzes."],
  ["Class 9-10 Science Batch", "Science", "SSC", "Offline", "Agrabad, Chattogram", 2200, 4, "rahim", "Physics, chemistry and biology with weekly model tests."],
  // Free tutor এর ঠিক ২টা post (limit পূর্ণ)
  ["Biology Admission Prep", "Biology", "Admission", "Online", "Online (Zoom)", 2600, 3, "imran", "Medical and varsity admission biology with daily MCQ practice."],
  ["Class 10 ICT Basics", "ICT", "SSC", "Offline", "Pahartali, Chattogram", 1400, 2, "imran", "ICT chapters, number systems and HTML basics for SSC students."],
];

await db.collection("tuitions").deleteMany({
  tutorEmail: { $in: Object.values(tutors).map((t) => t.email) },
});

const tuitionDocs = raw.map(
  ([title, subject, classLevel, mode, location, monthlyFee, daysPerWeek, t, description], i) => ({
    title, subject, classLevel, mode, location, monthlyFee, daysPerWeek, description,
    bannerImage: `https://picsum.photos/seed/mentor${i + 1}/800/500`,
    tutorName: tutors[t].name,
    tutorEmail: tutors[t].email,
    approvalStatus: "approved",
    isActive: true,
    createdAt: new Date(Date.now() - i * 86400000),
  })
);

// Admin approval flow test এর জন্য ১টা pending post
tuitionDocs.push({
  ...tuitionDocs[0],
  title: "Class 6 Math Foundation",
  classLevel: "Class 6",
  monthlyFee: 1200,
  approvalStatus: "pending",
  createdAt: new Date(),
});

const inserted = await db.collection("tuitions").insertMany(tuitionDocs);
const ids = Object.values(inserted.insertedIds).map(String);

// 3) Applications (tuitionId string হিসেবে সংরক্ষিত)
await db.collection("applications").deleteMany({
  studentEmail: { $regex: "@mentorlagbe.com$" },
});

const apps = [
  [0, "Sabbir Hossain", "student1@mentorlagbe.com", "accepted"],
  [2, "Sabbir Hossain", "student1@mentorlagbe.com", "pending"],
  [4, "Sabbir Hossain", "student1@mentorlagbe.com", "rejected"],
  [4, "Mim Chowdhury", "student2@mentorlagbe.com", "pending"],
  [7, "Mim Chowdhury", "student2@mentorlagbe.com", "accepted"],
  [12, "Mim Chowdhury", "student2@mentorlagbe.com", "pending"],
].map(([i, studentName, studentEmail, status]) => ({
  tuitionId: ids[i],
  tuitionTitle: tuitionDocs[i].title,
  subject: tuitionDocs[i].subject,
  monthlyFee: tuitionDocs[i].monthlyFee,
  tutorEmail: tuitionDocs[i].tutorEmail,
  studentName,
  studentEmail,
  studentPhone: "01700000000",
  preferredSchedule: "Evening, 6-8 PM",
  studentNote: "I want to improve my grades.",
  status,
  appliedAt: new Date(),
}));
await db.collection("applications").insertMany(apps);

// 4) Payments (Pro user দের জন্য, Admin revenue ও transactions এর জন্য)
await db.collection("payments").deleteMany({ transactionId: { $regex: "^seed_" } });

const proUsers = users.filter((u) => u.plan === "pro");
const payments = proUsers.map((u, i) => ({
  userEmail: u.email,
  userName: u.name,
  userRole: u.role,
  planName: u.role === "tutor" ? "Pro Tutor Plan" : "Pro Student Plan",
  amount: u.role === "tutor" ? 15 : 10, // dollar এ
  currency: "usd",
  transactionId: `seed_txn_${i + 1}`,
  stripeSessionId: `seed_cs_${i + 1}`,
  paymentStatus: "paid",
  paidAt: new Date(Date.now() - (i + 1) * 3 * 86400000),
}));
await db.collection("payments").insertMany(payments);

console.log(`✅ Seed complete: ${users.length} users, ${tuitionDocs.length} tuitions, ${apps.length} applications, ${payments.length} payments`);
await client.close();
process.exit(0);