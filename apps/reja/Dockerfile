FROM alpine:3.21

RUN apk add --no-cache tinyproxy \
  && mkdir -p /tmp/reja /var/lib/reja

COPY reja-lib.sh /usr/local/lib/reja-lib.sh
COPY reja-allow.sh /usr/local/bin/reja-allow
COPY docker-entrypoint.sh /usr/local/bin/chiwire-reja-entrypoint.sh

RUN chmod +x /usr/local/lib/reja-lib.sh \
  /usr/local/bin/reja-allow \
  /usr/local/bin/chiwire-reja-entrypoint.sh

EXPOSE 3128/tcp

VOLUME ["/var/lib/reja"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD nc -z 127.0.0.1 3128 || exit 1

ENTRYPOINT ["chiwire-reja-entrypoint.sh"]
CMD ["tinyproxy", "-d", "-c", "/tmp/reja/tinyproxy.conf"]
