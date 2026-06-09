FROM postgres:17-bookworm

RUN apt-get update \
  && apt-get install -y --no-install-recommends gettext-base pgbouncer \
  && rm -rf /var/lib/apt/lists/*

COPY pgbouncer.ini.template /etc/pgbouncer/pgbouncer.ini.template
COPY docker-entrypoint.sh /usr/local/bin/chiwire-postgres-entrypoint.sh

RUN chmod +x /usr/local/bin/chiwire-postgres-entrypoint.sh

EXPOSE 6432

HEALTHCHECK --interval=30s --timeout=5s --start-period=30s --retries=3 \
  CMD pg_isready -h 127.0.0.1 -p "${PGBOUNCER_LISTEN_PORT:-6432}" -U "${POSTGRES_USER:-postgres}" || exit 1

ENTRYPOINT ["chiwire-postgres-entrypoint.sh"]
CMD ["postgres"]
