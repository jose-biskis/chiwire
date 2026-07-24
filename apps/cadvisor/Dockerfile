FROM gcr.io/cadvisor/cadvisor:v0.55.1

EXPOSE 8080

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:8080/healthz || exit 1

# Prefer Docker containers only to keep metrics focused and lighter.
CMD ["--docker_only=true", "--housekeeping_interval=15s", "--store_container_labels=false"]
