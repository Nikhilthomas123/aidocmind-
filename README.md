# DocMind AI - Production-Ready Document Intelligence

DocMind AI is a production-ready, full-stack, AI-powered document intelligence and chat application. It allows users to register accounts, upload documents (PDF, DOCX, TXT), extract a comprehensive suite of 20 distinct AI insights (Executive Summaries, glossary indexes, dates, FAQ quizzes, improvements, etc.) streamed token-by-token, and chat securely with documents using RAG (Retrieval-Augmented Generation) constrained strictly to the uploaded file's contents.

## 🚀 Key Features

*   **Secure Auth**: JWT token authentication, login, signup, password crypt verification.
*   **Drag & Drop Upload**: Smooth drops up to 20MB supporting PDFs, DOCX, and TXT with stateful upload bars.
*   **20+ AI Document Insights**: Summaries, sentiment, reading metrics, keywords, suggested rewrites/translates streamed progressively.
*   **Contextual RAG Chat**: Ask questions sandbox style. The AI answers strictly using closest vector chunks.
*   **Smart Search**: Run query lookups inside uploaded text with yellow neon highlights over occurrences.
*   **Multi-Format Exports**: Download summaries/insights as formatted PDF, DOCX, or plain TXT.
*   **Star Favorites & Deletion**: Bookmark documents, view log lists, and delete history cascades.
*   **Dual Mode Deployment**: Run local hot-reloaded containers OR compile to a single AWS App Runner production image.

---

## 🛠 Technology Stack

*   **Frontend**: React (Vite, TypeScript, Tailwind CSS v4, Framer Motion animations, React Dropzone, React Markdown).
*   **Backend**: Python FastAPI (Uvicorn async servers).
*   **Database**: PostgreSQL with `pgvector` extension for storing relational user logs and embeddings.
*   **LLM Provider**: OpenAI API (GPT-4o for completions/summaries, text-embedding-3-small for 1536-dim vectors).
*   **Libraries**: PyMuPDF, pdfplumber, python-docx, reportlab.

---

## 💻 Local Development

Ensure you have **Node.js v20+** and **Python 3.11+** installed.

### 1. Database Setup
Ensure you have a PostgreSQL database running and install the `pgvector` extension:
```sql
CREATE EXTENSION IF NOT EXISTS vector;
```

### 2. Backend Setup
1. Change directory to `backend/` and create a virtual environment:
   ```bash
   cd backend
   python -m venv venv
   source venv/Scripts/activate  # On Windows: venv\Scripts\activate
   ```
2. Install python package requirements:
   ```bash
   pip install -r requirements.txt
   ```
3. Create a `.env` file (copied from `.env.example` in root) and configure:
   *   `DATABASE_URL=postgresql+asyncpg://postgres:postgres@localhost:5432/docmind`
   *   `OPENAI_API_KEY=your_key`
4. Start uvicorn development server:
   ```bash
   uvicorn main:app --reload --port 8000
   ```

### 3. Frontend Setup
1. Change directory to `frontend/` and install dependencies:
   ```bash
   cd frontend
   npm install
   ```
2. Start the Vite React development server:
   ```bash
   npm run dev
   ```
3. Open browser client at `http://localhost:5173`.

---

## 🐳 Docker Workflows (Local Compose)

Run the entire multi-container environment (PostgreSQL + FastAPI + React Dev Server) instantly using Docker Compose:

1. Create a `.env` file at the root directory of the project:
   ```env
   OPENAI_API_KEY=sk-proj-your-key-here
   JWT_SECRET_KEY=custom-random-secret-hash
   ```
2. Build and launch services:
   ```bash
   docker-compose up --build
   ```
3. Open browser client at `http://localhost:5173`.

---

## ☁️ AWS App Runner Deployment

AWS App Runner runs a **single container** exposing a single port. Our production configuration supports this by serving the compiled React static SPA assets from the FastAPI server directly inside the same container.

### Step 1: Set Up External Database
AWS App Runner container instances are ephemeral. Set up a managed **AWS RDS PostgreSQL** instance, ensure the security groups allow network ingress from the container, and run the pgvector extension load commands.

### Step 2: Build Production Container Image
The root `Dockerfile` uses a multi-stage configuration:
1.  **Stage 1**: Compiles the React project into static output files (`frontend/dist`).
2.  **Stage 3 (Final)**: Copies the built React assets into the FastAPI python container and exposes port `8888` / `8080`.

To build the image locally and test:
```bash
docker build -t docmind-ai:prod .
```

### Step 3: Publish to AWS ECR
Create an AWS ECR repository, authenticate your docker CLI, tag your production image, and push it:
```bash
aws ecr get-login-password --region us-east-1 | docker login --username AWS --password-stdin <YOUR_AWS_ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com

docker tag docmind-ai:prod <YOUR_AWS_ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/docmind-ai:latest

docker push <YOUR_AWS_ACCOUNT>.dkr.ecr.us-east-1.amazonaws.com/docmind-ai:latest
```

### Step 4: Configure App Runner Service
Create a new App Runner service pointing to your ECR image:
*   **Port Config**: Set container port binding to **`8080`**.
*   **Environment Variables**: Add these parameters in App Runner Settings:
    *   `DATABASE_URL` (Point to your AWS RDS instance: `postgresql+asyncpg://<USER>:<PASS>@<HOST>:<PORT>/<DB>`)
    *   `OPENAI_API_KEY` (Your OpenAI API production credential)
    *   `JWT_SECRET_KEY` (A production-strength random secret hash)
*   Deploy the service. App Runner will automatically handle routing SSL termination and auto-scale your container!
