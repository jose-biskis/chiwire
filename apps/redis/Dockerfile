FROM redis:8-alpine

COPY redis.conf /usr/local/etc/redis/redis.conf
COPY docker-entrypoint.sh /usr/local/bin/chiwire-redis-entrypoint.sh

RUN chmod +x /usr/local/bin/chiwire-redis-entrypoint.sh

EXPOSE 6379

HEALTHCHECK --interval=30s --timeout=3s --start-period=10s --retries=3 \
  CMD if [ -n "$REDIS_PASSWORD" ]; then redis-cli -a "$REDIS_PASSWORD" ping; else redis-cli ping; fi | grep -q PONG

USER redis
ENTRYPOINT ["chiwire-redis-entrypoint.sh"]
CMD ["redis-server", "/tmp/redis-cache.conf"]
