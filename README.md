# SpatialAblate: Spatial Omics Ablation & Leaderboard Platform

![SpatialAblate Banner](/public/vercel.svg) <!-- TODO: Replace with actual banner if available -->

**SpatialAblate** is a comprehensive full-stack Next.js web application designed to track, benchmark, and analyze deep learning models in the **Spatial Multi-Omics** domain. It provides researchers with a centralized leaderboard to compare base model performance across various biological datasets and a dedicated workspace to dive deep into **Ablation Studies**.

## 🌟 Key Features

- **🏆 Global Leaderboard**: Rank and compare spatial omics models across 15+ complex biological datasets (e.g., Human Lymph Node, Mouse Brain) based on ARI, NMI, and Silhouette scores.
- **🔬 Ablation Studies Dashboard**: A dedicated, hierarchical tracking system to analyze how individual model components (like Graph Attention, Contrastive Learning, and Decoders) impact overall clustering performance.
- **📊 Dynamic Result Submissions**: Upload and parse large-scale CSV benchmarking results instantly using the integrated client-side parser.
- **📝 Markdown & LaTeX Support**: Document mathematical methodologies (e.g., $E = mc^2$) and theoretical findings using rich markdown text.
- **🖼️ Methodology Gallery**: Upload visual architecture flows and methodology diagrams to accompany statistical results.
- **🌓 Dark/Light Mode**: Beautiful, responsive, and accessible UI crafted with Tailwind CSS and Next.js.

## 🛠️ Technology Stack

- **Frontend**: Next.js 14+ (App Router), React 18, Tailwind CSS v4, Lucide React (Icons), Framer Motion (Animations).
- **Backend**: Next.js API Routes (Serverless), MongoDB & Mongoose (Database).
- **Data Visualization**: Recharts (for analytics), Mermaid.js (for architecture diagrams).
- **Authentication**: JWT & bcrypt (for Admin & User roles).
- **File Storage**: Cloudinary (for image hosting).

## 🚀 Quick Start

### Prerequisites
- Node.js (v18 or newer)
- MongoDB (Local or Atlas)

### Installation

1. **Clone the repository:**
   ```bash
   git clone https://github.com/your-username/fydp-leaderboard-nextjs.git
   cd fydp-leaderboard-nextjs
   ```

2. **Install dependencies:**
   ```bash
   npm install
   ```

3. **Configure Environment Variables:**
   Create a `.env` or `.env.local` file in the root directory:
   ```env
   # Database
   MONGO_URI=mongodb://127.0.0.1:27017/spatialablate

   # JWT Authentication
   JWT_SECRET=your_super_secret_jwt_key

   # Cloudinary (For Image Uploads)
   CLOUDINARY_CLOUD_NAME=your_cloud_name
   CLOUDINARY_API_KEY=your_api_key
   CLOUDINARY_API_SECRET=your_api_secret

   # Admin Seed Credentials
   ADMIN_EMAIL=admin@gmail.com
   ADMIN_PASSWORD=admin
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

5. **Open the App:**
   Navigate to [http://localhost:3000](http://localhost:3000) in your browser. The database will automatically seed itself on the first API request!

## 📂 Project Structure

- `/src/app`: Next.js App Router pages and API endpoints.
  - `/api`: Serverless backend routes for Authentication, Models, Ablations, and Uploads.
  - `/models`: Dynamic model detail pages.
  - `/ablation`: The Ablation Studies dashboard.
  - `/submit`: Data submission wizard.
- `/src/components`: Reusable UI components (NavBar, Modals, Forms).
- `/src/context`: React Context providers for global State, Auth, and Theme management.
- `/src/models`: Mongoose database schemas.

## 📄 Documentation

For deep dives into the architecture and data flows, please refer to the following documents:
- [System Architecture](./SYSTEM_ARCHITECTURE.md)
- [Data Flow Diagram](./DATA_FLOW.md)
- [API Submission Guide](./API_SUBMISSION_GUIDE.md)

---
*Built with ❤️ for Bioinformatics & Spatial Omics Research.*
