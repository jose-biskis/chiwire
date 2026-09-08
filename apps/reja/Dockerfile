FROM alpine:3.21

RUN apk add --no-cache tinyproxy \
  && mkdir -p /tmp/reja

COPY docker-entrypoint.sh /usr/local/bin/chiwire-reja-entrypoint.sh
RUN chmod +x /usr/local/bin/chiwire-reja-entrypoint.sh

EXPOSE 3128/tcp

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD nc -z 127.0.0.1 3128 || exit 1

ENTRYPOINT ["chiwire-reja-entrypoint.sh"]
CMD ["tinyproxy", "-d", "-c", "/tmp/reja/tinyproxy.conf"]
