FROM alpine:3.21

RUN apk add --no-cache unbound bind-tools \
  && mkdir -p /tmp/eldenese /var/lib/eldenese

COPY eldenese-lib.sh /usr/local/lib/eldenese-lib.sh
COPY eldenese-allow.sh /usr/local/bin/eldenese-allow
COPY docker-entrypoint.sh /usr/local/bin/chiwire-eldenese-entrypoint.sh

RUN chmod +x /usr/local/lib/eldenese-lib.sh \
  /usr/local/bin/eldenese-allow \
  /usr/local/bin/chiwire-eldenese-entrypoint.sh

EXPOSE 53/tcp 53/udp

VOLUME ["/var/lib/eldenese"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=15s --retries=3 \
  CMD dig +short +time=2 +tries=1 @127.0.0.1 localhost >/dev/null || exit 1

ENTRYPOINT ["chiwire-eldenese-entrypoint.sh"]
CMD ["unbound", "-d", "-c", "/tmp/eldenese/unbound.conf"]
