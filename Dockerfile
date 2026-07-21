FROM python:3.11-slim

# Install system dependencies
RUN apt-get update && apt-get install -y build-essential && rm -rf /var/lib/apt/lists/*

# Hugging Face Spaces requires running as a non-root user
RUN useradd -m -u 1000 user
USER user
ENV HOME=/home/user \
    PATH=/home/user/.local/bin:$PATH

WORKDIR $HOME/app

# Copy the backend requirements first
COPY --chown=user:user backend/requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt


# Copy the rest of the backend files
COPY --chown=user:user backend/ .

# Expose port 7860 (Hugging Face default)
EXPOSE 7860

# Run on port 7860
CMD ["uvicorn", "app.main:app", "--host", "0.0.0.0", "--port", "7860"]
