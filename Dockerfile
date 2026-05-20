FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV FLASK_APP=app.py

EXPOSE 8080

CMD flask db upgrade && gunicorn app:app --bind 0.0.0.0:$PORT
