FROM python:3.11-slim

WORKDIR /app

# Install system dependencies required for Pillow
RUN apt-get update && apt-get install -y --no-install-recommends \
    libjpeg-dev \
    zlib1g-dev \
    libpng-dev \
    libfreetype6-dev \
    liblcms2-dev \
    libwebp-dev \
    && rm -rf /var/lib/apt/lists/*

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p crowd_data/submissions crowd_data/images crowd_data/thumbnails crowd_data/intel crowd_data/volunteers crowd_data/scraped_news

EXPOSE 8005

# Run the application with Gunicorn for production stability
CMD ["gunicorn", "-c", "gunicorn.conf.py", "app:app"]
