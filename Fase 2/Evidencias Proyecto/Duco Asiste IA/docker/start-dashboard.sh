x11vnc -display "$DISPLAY" -localhost -forever -shared -nopw -rfbport 5900 &
websockify --web /usr/share/novnc 6080 localhost:5900 &
exec /opt/venv/bin/python /app/admin-app/desktop_dashboard.py
