FROM alpine:3.21

RUN apk add --no-cache strongswan iptables openssl iproute2 \
  && mkdir -p /var/lib/paso /etc/ipsec.d/cacerts /etc/ipsec.d/certs /etc/ipsec.d/private

COPY docker-entrypoint.sh /usr/local/bin/chiwire-paso-entrypoint.sh
RUN chmod +x /usr/local/bin/chiwire-paso-entrypoint.sh

EXPOSE 500/udp 4500/udp

VOLUME ["/var/lib/paso"]

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD ipsec status >/dev/null || exit 1

ENTRYPOINT ["chiwire-paso-entrypoint.sh"]
CMD ["ipsec", "start", "--nofork"]
