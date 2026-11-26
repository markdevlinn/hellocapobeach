# Hello Capo Beach

A private neighborhood web app for Harbor Estates residents. Live at https://www.hellocapobeach.com

## What is here

| Folder | What it is |
|---|---|
| `app/` | The website (Next.js, exported as static files) |
| `api/` | The API (Azure Functions, TypeScript). All access rules live here. |
| `db/schema.sql` | The Azure SQL database tables and starting data |
| `public/` | Icons, the install manifest, and the Azure Static Web Apps config |
| `.github/workflows/deploy.yml` | Deploys to Azure on every push to `main` |

## Run it locally

```
npm install
npm run dev
```

The API runs separately with Azure Functions Core Tools:

```
cd api
npm install
npm run build
npm start
```

## Deploy

Push to `main`. GitHub Actions builds the site and the API and publishes both to the
Azure Static Web App `swa-hellocapobeach`. The deploy token is stored as the repository
secret `AZURE_STATIC_WEB_APPS_API_TOKEN`.

## Privacy rules the code must keep

- Nothing about neighbors is visible without an approved login.
- The site tells search engines not to index it.
- Phone, email and house number show only when the member turns them on.
