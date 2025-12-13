# Create Plan Request Examples - Paymob Integration

## Endpoint

**POST** `/api/admin/plans`

**Headers:**
```
Authorization: Bearer <admin_jwt_token>
Content-Type: application/json
```

---

## Example 1: Paymob Plan with Multi-Currency Prices

### Request Body

```json
{
  "name": "Starter",
  "registerationType": "fattening",
  "prices": [
    {
      "country": "EG",
      "currency": "EGP",
      "amount": 10000
    },
    {
      "country": "SA",
      "currency": "SAR",
      "amount": 3000
    },
    {
      "country": "US",
      "currency": "USD",
      "amount": 1000
    }
  ],
  "animalLimit": 50,
  "interval": "month",
  "intervalCount": 1,
  "isActive": true
}
```

### Response (Success)

```json
{
  "status": "success",
  "message": "Plan created successfully",
  "data": {
    "_id": "507f1f77bcf86cd799439011",
    "name": "Starter",
    "registerationType": "fattening",
    "prices": [
      {
        "country": "EG",
        "currency": "EGP",
        "amount": 10000
      },
      {
        "country": "SA",
        "currency": "SAR",
        "amount": 3000
      },
      {
        "country": "US",
        "currency": "USD",
        "amount": 1000
      }
    ],
    "animalLimit": 50,
    "interval": "month",
    "intervalCount": 1,
    "isActive": true,
    "createdAt": "2025-12-13T17:14:00.000Z",
    "updatedAt": "2025-12-13T17:14:00.000Z"
  }
}
```

---

## Example 2: Paymob Plan for Breeding Type

### Request Body

```json
{
  "name": "Pro",
  "registerationType": "breeding",
  "prices": [
    {
      "country": "EG",
      "currency": "EGP",
      "amount": 20000
    },
    {
      "country": "SA",
      "currency": "SAR",
      "amount": 6000
    },
    {
      "country": "US",
      "currency": "USD",
      "amount": 2000
    }
  ],
  "animalLimit": 100,
  "interval": "month",
  "intervalCount": 1,
  "isActive": true
}
```

---

## Example 3: Paymob Plan with Yearly Billing

### Request Body

```json
{
  "name": "Enterprise",
  "registerationType": "fattening",
  "prices": [
    {
      "country": "EG",
      "currency": "EGP",
      "amount": 100000
    },
    {
      "country": "SA",
      "currency": "SAR",
      "amount": 30000
    },
    {
      "country": "US",
      "currency": "USD",
      "amount": 10000
    }
  ],
  "animalLimit": 500,
  "interval": "year",
  "intervalCount": 1,
  "isActive": true
}
```

---

## Example 4: Legacy Stripe Plan (Still Supported)

### Request Body

```json
{
  "name": "Stripe Plan",
  "registerationType": "fattening",
  "stripePriceId": "price_1234567890",
  "currency": "usd",
  "amount": 1000,
  "animalLimit": 50,
  "interval": "month",
  "intervalCount": 1,
  "isActive": true
}
```

---

## Field Descriptions

### Required Fields

- **name** (string): Plan name (e.g., "Starter", "Pro", "Enterprise")
- **registerationType** (string): Either `"fattening"` or `"breeding"`
- **animalLimit** (number): Maximum number of animals allowed for this plan
- **prices** (array): Required for Paymob plans. Array of price objects with:
  - **country** (string): ISO country code (e.g., "EG", "SA", "US")
  - **currency** (string): Currency code (e.g., "EGP", "SAR", "USD")
  - **amount** (number): Amount in smallest currency unit

### Optional Fields

- **interval** (string): Billing interval - `"month"` (default) or `"year"`
- **intervalCount** (number): Number of intervals (default: 1)
- **isActive** (boolean): Whether plan is active (default: true)

### Legacy Stripe Fields (Optional)

- **stripePriceId** (string): Stripe price ID (required if using Stripe)
- **currency** (string): Currency code (for Stripe plans)
- **amount** (number): Amount in smallest currency unit (for Stripe plans)

---

## Amount Format

**Important:** All amounts must be in the currency's smallest unit:

- **EGP**: Piasters (1 EGP = 100 piasters)
  - Example: 100 EGP = `10000`
- **SAR**: Halalas (1 SAR = 100 halalas)
  - Example: 30 SAR = `3000`
- **USD**: Cents (1 USD = 100 cents)
  - Example: 10 USD = `1000`

---

## Error Responses

### Missing Required Fields

```json
{
  "status": "fail",
  "message": "Missing required fields: name, registerationType, animalLimit",
  "code": 400,
  "data": null
}
```

### Invalid Prices Array

```json
{
  "status": "fail",
  "message": "Each price in prices array must have: country, currency, and amount",
  "code": 400,
  "data": null
}
```

### Plan Already Exists

```json
{
  "status": "fail",
  "message": "Plan with this registration type and name already exists",
  "code": 400,
  "data": null
}
```

---

## cURL Examples

### Create Paymob Plan

```bash
curl -X POST https://your-domain.com/api/admin/plans \
  -H "Authorization: Bearer YOUR_ADMIN_TOKEN" \
  -H "Content-Type: application/json" \
  -d '{
    "name": "Starter",
    "registerationType": "fattening",
    "prices": [
      {"country": "EG", "currency": "EGP", "amount": 10000},
      {"country": "SA", "currency": "SAR", "amount": 3000},
      {"country": "US", "currency": "USD", "amount": 1000}
    ],
    "animalLimit": 50,
    "interval": "month",
    "isActive": true
  }'
```

---

## Notes

1. **Paymob vs Stripe**: Use `prices` array for Paymob, or `stripePriceId` + `amount` for Stripe
2. **Country Codes**: Use ISO 2-letter country codes (e.g., "EG", "SA", "US")
3. **Currency Codes**: Use uppercase 3-letter currency codes (e.g., "EGP", "SAR", "USD")
4. **Amounts**: Always in smallest currency unit (piasters, halalas, cents)
5. **Admin Only**: This endpoint requires admin authentication

