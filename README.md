# MentorLagbe Server

Express.js & MongoDB backend for MentorLagbe - A role-based tuition & mentorship management platform.

## Features
- **BetterAuth Integration:** Role-based authentication (`student`, `tutor`, `admin`) with MongoDB adapter.
- **JWT Authorization:** Role verification middlewares (`verifyToken`, `verifyStudent`, `verifyTutor`, `verifyAdmin`).
- **Tuitions Management:** Search, multi-field filtering, pagination, tutor CRUD, and free-plan limits (max 2 tuitions for free plan).
- **Application Workflow:** Student enrollment applications, pending status, tutor acceptance/rejection, and student cancellation.
- **Stripe Subscriptions:** Stripe Checkout session creation and session verification updating payments collection and user plan to `pro`.
- **Admin Endpoints:** Platform statistics, user role updates, tuition approvals/rejections, and payment records.

## Collections
1. `users`: Stores user profile, role, plan (`free` | `pro`), phone, bio, and image.
2. `tuitions`: Stores tuition posts with `approvalStatus` (`pending` | `approved` | `rejected`) and `isActive`.
3. `applications`: Stores student applications with `status` (`pending` | `accepted` | `rejected`).
4. `payments`: Stores Stripe subscription transactions.

## Seed Initial Data
```bash
node seed.js
```
Populates verified tutors, approved tuitions across subjects, sample applications, and Stripe payment records.
