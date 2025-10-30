FROM denoland/deno:1.44.4

WORKDIR /app

# Copy import map and deno config first for better caching
COPY import_map.json deno.json ./

# Copy the rest of the application
COPY . .

# Run unprivileged
USER deno

EXPOSE 8000

CMD ["deno", "run", "--allow-all", "--unstable-sloppy-imports", "--no-check", "--import-map=import_map.json", "src/server.ts"]
