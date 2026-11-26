FROM python:3.12-slim
WORKDIR /app
ENV PYTHONDONTWRITEBYTECODE=1 PYTHONUNBUFFERED=1
COPY admin-app/requirements.txt admin-app/requirements.txt
RUN pip install --no-cache-dir -r admin-app/requirements.txt
COPY admin-app/app.py admin-app/auth.py admin-app/external_apis.py admin-app/web_lookup.py admin-app/
COPY *.html ./
COPY assets/ assets/
COPY carreras-detalle/ carreras-detalle/
COPY css/ css/
COPY dibujos/ dibujos/
COPY duoc_files/ duoc_files/
COPY js/ js/
USER 10001
EXPOSE 8765
CMD ["python", "admin-app/app.py"]
