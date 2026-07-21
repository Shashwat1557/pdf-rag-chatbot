FROM python:3.11-slim

WORKDIR /app

# Install system dependencies if required by chroma or sentence-transformers
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

# Pre-download the HuggingFace embeddings model during the build step 
# so the server starts instantly and doesn't time out on Render.
RUN python -c "from sentence_transformers import SentenceTransformer; SentenceTransformer('all-MiniLM-L6-v2')"

COPY . .

# Start the FastAPI app and bind to the PORT environment variable provided by Render/Railway
CMD ["sh", "-c", "uvicorn app.main:app --host 0.0.0.0 --port ${PORT:-8000}"]
