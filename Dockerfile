FROM runcitadel/deno:main
WORKDIR /app

COPY . .

RUN deno vendor app.ts

EXPOSE 3000

CMD ["deno", "run", "--unstable", "--no-remote", "--import-map=vendor/import_map.json", "--allow-all", "app.ts"]
