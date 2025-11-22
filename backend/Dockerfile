FROM python:3.11-slim

WORKDIR /app

COPY requirements.txt .
RUN pip install --no-cache-dir -r requirements.txt

COPY . .

ENV PORT=8080
EXPOSE 8080

# Detect correct entry file:
# If main.py exists, use:
# CMD ["python", "main.py"]
#
# If app.py exists, use:
# CMD ["python", "app.py"]
#
# If server.py exists, use:
# CMD ["python", "server.py"]
#
# Otherwise, choose the file that contains create_app()
CMD ["python", "main.py"]
