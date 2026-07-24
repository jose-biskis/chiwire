FROM prom/prometheus:v3.13.1 AS prometheus
FROM quay.io/prometheus/node-exporter:v1.12.1 AS node_exporter
FROM debian:bookworm-slim

RUN apt-get update \
  && apt-get install -y --no-install-recommends ca-certificates wget \
  && rm -rf /var/lib/apt/lists/*

COPY --from=prometheus /bin/prometheus /usr/local/bin/prometheus
COPY --from=prometheus /bin/promtool /usr/local/bin/promtool
COPY --from=node_exporter /bin/node_exporter /usr/local/bin/node_exporter

COPY prometheus.yml /etc/prometheus/prometheus.yml
COPY docker-entrypoint.sh /usr/local/bin/chiwire-prometheus-entrypoint.sh

RUN chmod +x /usr/local/bin/chiwire-prometheus-entrypoint.sh \
  && mkdir -p /prometheus \
  && chown -R nobody:nogroup /prometheus /etc/prometheus

EXPOSE 9090

HEALTHCHECK --interval=30s --timeout=5s --start-period=20s --retries=3 \
  CMD wget -q -O /dev/null http://127.0.0.1:9090/-/ready || exit 1

ENTRYPOINT ["chiwire-prometheus-entrypoint.sh"]
CMD ["prometheus"]
