# Gemini Context File (GEMINI.md)

This file provides context for the Gemini AI agent working on the `backend-hackathon` project.

## 📂 Project Overview

**Name:** `backend-hackathon` (Smart Parking System)
**Architecture:** Hybrid Microservices/Monolith
1.  **Main Backend (NestJS):** Handles user management, authentication, business logic, and API exposure.
2.  **Detection Service (Python):** A specialized microservice using YOLOv8 and Flask for vehicle detection in parking zones.
3.  **Database:** PostgreSQL (managed via TypeORM in NestJS).

## 🛠️ Main Backend (NestJS)

Located in the project root.

### Key Technologies
*   **Framework:** NestJS (v11)
*   **Language:** TypeScript
*   **Database ORM:** TypeORM (PostgreSQL)
*   **Auth:** JWT (`@nestjs/jwt`, `passport-jwt`), Custom `AuthMiddleware`
*   **Documentation:** Swagger (`@nestjs/swagger`)

### Core Modules (`src/`)
*   **`AppModule`**: Root module. Configures ConfigModule, TypeORM, and global middleware.
*   **`AuthModule`**: Handles Login/Register logic and JWT strategy.
*   **`UserModule`**: User management (CRUD).
*   **`CameraModule`**: Manages camera configurations and parking zones.
*   **`ChatbotModule`**: (Implied from file list) Handles chatbot interactions.

### Development Commands
*   **Install:** `npm install`
*   **Run (Dev):** `npm run start:dev` (Watch mode)
*   **Run (Prod):** `npm run start:prod`
*   **Build:** `npm run build`
*   **Test:** `npm run test` (Unit), `npm run test:e2e` (E2E)
*   **Lint:** `npm run lint`
*   **Format:** `npm run format`

### Database Migrations
*   **Generate:** `npm run migration:generate -- -n <MigrationName>`
*   **Run:** `npm run migration:run`
*   **Revert:** `npm run migration:revert`

### API Documentation
Swagger is available at `http://localhost:3000/api` when the server is running.

## 🐍 Detection Service (Python)

Located in `python-detection-service/`.

### Key Technologies
*   **Framework:** Flask
*   **AI/ML:** YOLOv8 (`ultralytics`), OpenCV (`opencv-python`), PyTorch
*   **Language:** Python 3

### Setup & Run
1.  **Create Venv:** `python3 -m venv venv`
2.  **Activate:** `source venv/bin/activate` (Unix) or `venv\Scripts\activate` (Win)
3.  **Install:** `pip install -r requirements.txt`
4.  **Run:** `python app.py`

### Key Endpoints
*   `POST /api/detect`: Process a frame.
*   `POST /api/zones/sync`: Sync parking zones.
*   `POST /api/stream/start`: Start video stream processing.

## 🐳 Docker

A `docker-compose.yml` file exists in the root, currently defining the `backend-hackaton` service.

## 📝 Conventions & Style
*   **Code Style:** Prettier (`.prettierrc`) and ESLint (`eslint.config.mjs`) are enforced.
*   **Naming:** kebab-case for files, PascalCase for classes, camelCase for variables/methods.
*   **Env Vars:** Uses `.env` file (ensure `.env.example` is followed).
*   **Auth:** Most routes are protected by `AuthMiddleware`. Exceptions are defined in `AppModule` (e.g., auth endpoints, public camera data).

## ⚠️ Important Notes
*   The `AuthMiddleware` in `AppModule` explicitly excludes several `camera/*` routes to facilitate development/integration without auth tokens. Be mindful of security when moving to production.
*   The system expects a PostgreSQL database to be available.
