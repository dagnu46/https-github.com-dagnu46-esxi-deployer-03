# Running Server Firmware Manager Locally in Docker with PostgreSQL

This application is ready to run on your local server or workstation using Docker and Docker Compose, with full persistence in a local PostgreSQL database.

## Prerequisites
- **Docker Engine** 20.10+
- **Docker Compose** v2+ (included with modern Docker Desktop and Docker CLI `docker compose`)

---

## Quick Start (One Command)

From the root directory of this project, execute:

```bash
docker compose up --build -d
```

This single command will:
1. Start a persistent **PostgreSQL 16** database container (`firmware-hub-postgres`).
2. Run database initialization scripts from `init-db.sql`.
3. Build the production multi-stage container for the application (`firmware-hub-app`).
4. Wait for PostgreSQL to pass its health check, then boot the Node.js backend.
5. Serve the unified application on `http://localhost:3000`.

Open your browser at:
👉 **`http://localhost:3000`**

---

## Useful Docker Commands

### View live logs
```bash
# Follow both application and database logs
docker compose logs -f

# Follow only app logs
docker compose logs -f app

# Follow only PostgreSQL logs
docker compose logs -f postgres
```

### Stop the application
```bash
# Stop containers (preserves database data)
docker compose down
```

### Reset database and clean volumes
```bash
# Remove containers and erase persistent database volume
docker compose down -v
```

### Connect to PostgreSQL CLI directly
```bash
docker compose exec postgres psql -U Dagnu -d firmware_hub
```

### Running PostgreSQL Container Manually (without Docker Compose)
If you prefer running the PostgreSQL container manually with `docker run`, you must pass `-e POSTGRES_PASSWORD`:
```bash
docker run -d \
  --name firmware-hub-postgres \
  -e POSTGRES_USER=Dagnu \
  -e POSTGRES_PASSWORD='Dagnu0046!' \
  -e POSTGRES_DB=firmware_hub \
  -p 5432:5432 \
  -v $(pwd)/init-db.sql:/docker-entrypoint-initdb.d/01-init.sql:ro \
  postgres:16-alpine
```

---

## Local Development Without Docker
If you have a local PostgreSQL instance already running on your machine:
1. Create a database: `createdb firmware_hub`
2. Configure your `.env` file:
   ```env
   DATABASE_URL="postgres://Dagnu:Dagnu0046%21@localhost:5432/firmware_hub"
   ```
3. Install dependencies and start development server:
   ```bash
   npm install
   npm run dev
   ```
The app will connect to your local PostgreSQL database, auto-create all tables, and seed initial fleet data.
