# CommercePilot

CommercePilot is an AI-powered commerce MVP. It lets customers describe what
they want in natural language, receive catalogue-backed product
recommendations, manage a cart, and pay using Razorpay.

## MVP features

- AI-assisted product discovery using Groq tool calling
- Product filtering by category, price, rating, wireless support, and battery life
- Catalogue-backed complementary-product recommendations
- Session-based shopping cart with quantity controls
- Razorpay order creation and payment-signature verification
- Order snapshots, idempotent payment verification, and inventory reduction

## Tech stack

- Frontend: React, Vite, ESLint
- Backend: FastAPI, SQLAlchemy, PyMySQL
- Database: MySQL
- AI: Groq
- Payments: Razorpay

## Prerequisites

- Node.js 20 or later
- Python 3.9 or later
- MySQL running locally
- A Groq API key
- Razorpay **test-mode** API keys for development

## Setup

### 1. Create the database

In MySQL, create a database for the app:

```sql
CREATE DATABASE commercepilot;
```

### 2. Configure the backend

```bash
cd backend
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
cp .env.example .env
```

Edit `backend/.env` and add your local MySQL connection string and API keys:

```dotenv
DATABASE_URL=mysql+pymysql://USERNAME:PASSWORD@localhost:3306/commercepilot
RAZORPAY_KEY_ID=rzp_test_your_key_id
RAZORPAY_KEY_SECRET=your_razorpay_test_secret
GROQ_API_KEY=your_groq_api_key
```

Never commit this `.env` file. It is excluded by `.gitignore`.

Seed the catalogue and product relationships:

```bash
python -m app.database.seed
```

Start the API:

```bash
uvicorn app.main:app --reload
```

The API runs at `http://127.0.0.1:8000`. Interactive API documentation is
available at `http://127.0.0.1:8000/docs`.

### 3. Configure and run the frontend

Open a second terminal:

```bash
cd frontend
npm install
cp .env.example .env
npm run dev
```

The frontend runs at `http://localhost:5173` and defaults to the local API.
To use a different backend URL, set `VITE_API_BASE` in `frontend/.env`.

## Using the app

1. Ask for a product, for example: `wireless headphones under ₹3000`.
2. Add one or more recommendations to the cart.
3. Update quantities or remove products as needed.
4. Select **Proceed to Checkout** and complete the Razorpay test checkout.

## API overview

| Area | Endpoint |
| --- | --- |
| Products | `GET /api/products/`, `GET /api/products/search` |
| AI assistant | `POST /api/agent/chat?message=...` |
| Cart | `GET /api/cart`, `POST /api/cart/add`, `PATCH /api/cart/update`, `DELETE /api/cart/remove` |
| Payments | `POST /api/payment/create-order`, `POST /api/payment/verify` |

## Checks

Run the frontend quality checks before sharing changes:

```bash
cd frontend
npm run lint
npm run build
```

## Notes

This is an MVP intended for local development and demos. Before a production
release, add automated tests, database migrations, a payment webhook,
authentication, production deployment configuration, and monitoring.

