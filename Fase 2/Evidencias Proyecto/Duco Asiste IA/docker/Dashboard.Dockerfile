FROM debian:bookworm-slim
RUN apt-get update && apt-get install -y --no-install-recommends \
    python3 python3-venv python3-tk xvfb xauth x11vnc novnc websockify fonts-dejavu-core \
    && rm -rf /var/lib/apt/lists/*
WORKDIR /app
ENV PYTHONUNBUFFERED=1 PYTHONDONTWRITEBYTECODE=1
COPY admin-app/requirements.txt .
RUN python3 -m venv /opt/venv && /opt/venv/bin/pip install --no-cache-dir -r requirements.txt
COPY admin-app/app.py admin-app/auth.py admin-app/external_apis.py admin-app/web_lookup.py admin-app/desktop_dashboard.py admin-app/desktop_panel.py admin-app/create_admin.py admin-app/
COPY docker/start-dashboard.sh /app/start-dashboard.sh
USER 10001
EXPOSE 6080
CMD ["xvfb-run", "-a", "-s", "-screen 0 1440x900x24", "sh", "/app/start-dashboard.sh"]
