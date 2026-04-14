# --- Stage 1: Build Frontend ---
FROM node:18-slim AS build-frontend
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

# --- Stage 2: Serve with Backend ---
FROM python:3.10-slim
WORKDIR /app

# Install system dependencies
RUN apt-get update && apt-get install -y \
    curl \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements and install
COPY backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Copy backend source
COPY backend/ ./backend/

# Copy built frontend from Stage 1 into backend serving dir
COPY --from=build-frontend /app/frontend/dist ./frontend/dist

# Expose port (Cloud Run uses PORT env var, mapping to 8080)
EXPOSE 8080

# Environment variables
ENV PORT=8080
ENV BROADCAST_INTERVAL_SECS=6
ENV CORS_ORIGINS="*"

# Run with uvicorn
CMD ["uvicorn", "backend.main:app", "--host", "0.0.0.0", "--port", "8080", "--app-dir", "."]
