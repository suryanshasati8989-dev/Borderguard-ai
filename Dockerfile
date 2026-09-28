FROM node:18-alpine AS frontend-builder
WORKDIR /app/frontend
COPY frontend/package*.json ./
RUN npm install
COPY frontend/ ./
RUN npm run build

FROM python:3.11-slim
WORKDIR /app

# Install system dependencies for OpenCV and SQLite
RUN apt-get update && apt-get install -y \
    libglib2.0-0 libsm6 libxext6 libxrender-dev libgl1-mesa-glx \
    && rm -rf /var/lib/apt/lists/*

# Copy backend requirements
COPY backend/requirements.txt backend/requirements-ai.txt ./backend/
RUN pip install --no-cache-dir -r backend/requirements.txt -r backend/requirements-ai.txt

# Copy backend source code
COPY backend/ ./backend/
COPY ai-engine/ ./ai-engine/

# Copy built frontend from previous stage
COPY --from=frontend-builder /app/frontend/dist ./frontend/dist

# Expose port (Render sets PORT env variable, default 5000)
ENV PORT=5000
EXPOSE 5000

# Start Gunicorn
CMD cd backend && gunicorn "app.main:app" --bind 0.0.0.0:$PORT --workers 4 --threads 4 --timeout 120
