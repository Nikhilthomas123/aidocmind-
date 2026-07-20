# ==========================================
# STAGE 1: Compile React Frontend SPA
# ==========================================
FROM node:20-alpine AS frontend-builder
WORKDIR /app

# Copy package profiles and install packages
COPY frontend/package.json ./
RUN npm install

# Copy source assets and compile the static bundle
COPY frontend/ ./
RUN npm run build

# ==========================================
# STAGE 2: Build FastAPI Server Image
# ==========================================
FROM python:3.11-slim
WORKDIR /app

# Install system compiler utilities
RUN apt-get update && apt-get install -y \
    build-essential \
    libpq-dev \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install python packages
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend codebase
COPY backend/ ./

# Copy compiled frontend dist assets from STAGE 1 into backend static target
COPY --from=frontend-builder /app/dist ./dist

# Create local upload storage directory
RUN mkdir -p uploads

# Expose port (AWS App Runner binds dynamically, but we default to 8080)
EXPOSE 8080

# Run uvicorn server mapping to port 8080
CMD ["uvicorn", "main:app", "--host", "0.0.0.0", "--port", "8080"]
