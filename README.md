# Finance Tracker

A personal budgeting app for people in Poland that answers one question in three seconds: **"How much can I still spend this month?"**

Record spending manually or import a bank CSV (mBank, PKO BP, ING, Revolut), set a monthly limit per category, and see on one dashboard how close you are to each limit. Amounts are in PLN.

> **Status:** in development. Phase 1 (core app) is in progress. See the [implementation plan](.claude/docs/PLAN.md) for the roadmap.

## Tech stack

| Layer | Technology |
| --- | --- |
| Frontend | Angular 22 (standalone components, signals), Angular Material (M3), Vitest |
| Backend | ASP.NET Core Web API (.NET 10), EF Core + PostgreSQL, ASP.NET Core Identity + JWT, FluentValidation |
| Import pipeline | S3 pre-signed upload → S3 event → AWS Lambda (.NET) |
| Tests | xUnit + Testcontainers (PostgreSQL) integration tests, Vitest |
| Cloud (planned) | S3 + CloudFront, Elastic Beanstalk, RDS PostgreSQL, Lambda, Secrets Manager, CloudWatch |
| CI/CD (planned) | GitHub Actions, one path-filtered workflow per project |

## Repository layout

```
finance-tracker-api/   ASP.NET Core API, domain, EF Core, CSV import Lambda, integration tests
finance-tracker-web/   Angular frontend
.claude/docs/          Specification: PLAN.md (plan, data model, rules, API),
                       FEATURES.md (behavior, UI text, edge cases), DESIGN.md (UI brief)
```

Start with the [feature specification](.claude/docs/FEATURES.md) and the [implementation plan](.claude/docs/PLAN.md).

## Running locally

**Backend:** PostgreSQL and the API on http://localhost:5080:

```bash
cd finance-tracker-api
docker compose up -d --build
```

**Frontend:** http://localhost:4200, with `/api` proxied to the API:

```bash
cd finance-tracker-web
nvm use          # Node version from .nvmrc
npm ci
npm start
```

Each project's README has the details: prerequisites, tests, and configuration.
