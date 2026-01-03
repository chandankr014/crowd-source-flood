FROM python:3.11-slim

WORKDIR /app


COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

RUN mkdir -p crowd_data/submissions crowd_data/images crowd_data/thumbnails crowd_data/intel crowd_data/volunteers crowd_data/scraped_news

EXPOSE 8005

CMD ["python", "app.py"]
