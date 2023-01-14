FROM runcitadel/deno:v1.29.3
WORKDIR /app

COPY . .

RUN deno vendor app.ts https://deno.land/std@0.172.0/node/module_all.ts https://deno.land/x/bcrypt@v0.4.0/src/worker.ts

EXPOSE 3000

CMD ["deno", "run", "--unstable", "--import-map=vendor/import_map.json", "--allow-all", "app.ts"]
