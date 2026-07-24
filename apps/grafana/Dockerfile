FROM grafana/grafana:12.1.10

USER root

COPY provisioning /etc/grafana/provisioning
COPY dashboards /etc/grafana/dashboards
COPY docker-entrypoint.sh /usr/local/bin/chiwire-grafana-entrypoint.sh

RUN chmod +x /usr/local/bin/chiwire-grafana-entrypoint.sh \
  && mkdir -p /var/lib/grafana /var/log/grafana \
  && chown -R grafana:root /etc/grafana /var/lib/grafana /var/log/grafana

ENV GF_PATHS_CONFIG=/etc/grafana/grafana.ini \
  GF_PATHS_DATA=/var/lib/grafana \
  GF_PATHS_HOME=/usr/share/grafana \
  GF_PATHS_LOGS=/var/log/grafana \
  GF_PATHS_PLUGINS=/var/lib/grafana/plugins \
  GF_PATHS_PROVISIONING=/etc/grafana/provisioning \
  GF_USERS_ALLOW_SIGN_UP=false \
  GF_AUTH_ANONYMOUS_ENABLED=false

EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD wget -q -O - http://127.0.0.1:3000/api/health | grep -q '"database":"ok"' || exit 1

ENTRYPOINT ["chiwire-grafana-entrypoint.sh"]
CMD ["grafana"]
