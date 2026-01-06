# Postman Request - Scan Animal by QR Token

## 📋 Endpoint Details

**Method:** `GET`  
**URL:** `http://localhost:5000/api/scan/:token`  
**Auth:** Optional (works with or without token)

---

## 🔧 Postman Setup

### 1. Basic Request (Without Authentication)

#### Request Configuration:
- **Method:** `GET`
- **URL:** 
  ```
  http://localhost:5000/api/scan/abc123def456ghi789jkl012mno345pq
  ```
  (Replace `abc123...` with actual QR token)

#### Headers:
```
(No headers required)
```

#### Example:
```
GET http://localhost:5000/api/scan/abc123def456ghi789jkl012mno345pq
```

---

### 2. Request with Authentication (For Owner - Full Data)

#### Request Configuration:
- **Method:** `GET`
- **URL:** 
  ```
  http://localhost:5000/api/scan/abc123def456ghi789jkl012mno345pq
  ```

#### Headers:
```
Authorization: Bearer YOUR_JWT_TOKEN_HERE
```

#### Example:
```
GET http://localhost:5000/api/scan/abc123def456ghi789jkl012mno345pq
Headers:
  Authorization: Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9...
```

---

## 📝 Step-by-Step in Postman

### Step 1: Create New Request
1. Open Postman
2. Click **"New"** → **"HTTP Request"**
3. Set method to **GET**

### Step 2: Enter URL
1. In the URL field, enter:
   ```
   http://localhost:5000/api/scan/{{token}}
   ```
2. Replace `{{token}}` with actual QR token from an animal

### Step 3: Add Headers (Optional)
1. Go to **"Headers"** tab
2. Add header:
   - **Key:** `Authorization`
   - **Value:** `Bearer YOUR_TOKEN_HERE`
   (Only if you want to test as authenticated owner)

### Step 4: Send Request
1. Click **"Send"** button
2. View response

---

## ✅ Expected Response

### Success Response (200 OK)

#### Without Auth (Basic Info):
```json
{
  "status": "success",
  "data": {
    "animal": {
      "_id": "507f1f77bcf86cd799439011",
      "tagId": "TAG001",
      "animalType": "goat",
      "gender": "female",
      "locationShed": {
        "locationShedName": "Shed 1"
      },
      "breed": {
        "breedName": "Nubian"
      },
      "birthDate": "2024-01-01T00:00:00.000Z",
      "ageInDays": 365
    },
    "permissions": {
      "canAdd": false
    },
    "records": {
      "mating": [],
      "breeding": [],
      "weight": [
        {
          "_id": "...",
          "tagId": "TAG001",
          "Date": "2024-01-15T00:00:00.000Z",
          "weight": 25.5,
          "weightType": "birth"
        }
      ],
      "vaccines": [],
      "treatments": []
    }
  }
}
```

#### With Auth (Owner - Full Data):
```json
{
  "status": "success",
  "data": {
    "animal": {
      "_id": "507f1f77bcf86cd799439011",
      "tagId": "TAG001",
      "animalType": "goat",
      "gender": "female",
      "birthDate": "2024-01-01T00:00:00.000Z",
      "ageInDays": 365,
      "purchasePrice": 5000,
      "marketValue": 6000,
      "purchaseDate": "2024-01-01T00:00:00.000Z",
      "traderName": "Trader ABC",
      "motherId": "MOTHER001",
      "fatherId": "FATHER001",
      "locationShed": {
        "_id": "...",
        "locationShedName": "Shed 1"
      },
      "breed": {
        "_id": "...",
        "breedName": "Nubian"
      },
      "owner": "507f1f77bcf86cd799439012",
      "qrToken": "abc123def456ghi789jkl012mno345pq",
      "createdAt": "2024-01-01T00:00:00.000Z"
    },
    "permissions": {
      "canAdd": true
    },
    "records": {
      "mating": [...],
      "breeding": [...],
      "weight": [...],
      "vaccines": [...],
      "treatments": [...]
    }
  }
}
```

---

## ❌ Error Responses

### 400 Bad Request (Missing Token)
```json
{
  "status": "fail",
  "message": "QR token is required",
  "code": 400,
  "data": null
}
```

### 404 Not Found (Invalid Token)
```json
{
  "status": "fail",
  "message": "Animal not found",
  "code": 404,
  "data": null
}
```

---

## 🔍 How to Get QR Token for Testing

### Option 1: From Add Animal Response
When you create an animal via `POST /api/animal/addanimal`, the response includes `qrLink`:
```json
{
  "status": "success",
  "data": {
    "animal": { ... },
    "qrLink": "https://mazraaonline.com/scan/abc123..."
  }
}
```
Extract the token from the URL: `abc123...`

### Option 2: From Database
Query MongoDB:
```javascript
db.animals.findOne({ tagId: "TAG001" }, { qrToken: 1 })
```

### Option 3: From Get All Animals Response
Call `GET /api/animal/getallanimals` and find an animal with `qrToken` field.

---

## 📋 Postman Collection Example

### Environment Variables
Create a Postman environment with:
```
base_url: http://localhost:5000
token: YOUR_JWT_TOKEN
qr_token: abc123def456ghi789jkl012mno345pq
```

### Request URL (Using Variables)
```
{{base_url}}/api/scan/{{qr_token}}
```

### Headers (Using Variables)
```
Authorization: Bearer {{token}}
```

---

## 🧪 Test Cases

### Test Case 1: Valid Token Without Auth
- **URL:** `GET /api/scan/abc123...`
- **Headers:** None
- **Expected:** 200 OK with basic animal info
- **canAdd:** `false`

### Test Case 2: Valid Token With Owner Auth
- **URL:** `GET /api/scan/abc123...`
- **Headers:** `Authorization: Bearer <owner_token>`
- **Expected:** 200 OK with full animal data
- **canAdd:** `true`

### Test Case 3: Invalid Token
- **URL:** `GET /api/scan/invalid_token_123`
- **Expected:** 404 Not Found

### Test Case 4: Missing Token
- **URL:** `GET /api/scan/`
- **Expected:** 400 Bad Request

---

## 💡 Tips

1. **Get QR Token First:** Before testing, make sure you have a valid QR token from an existing animal.

2. **Test Both Scenarios:** 
   - Test without auth (anonymous access)
   - Test with owner token (full access)

3. **Check Permissions:** 
   - `canAdd: false` = Anonymous or non-owner
   - `canAdd: true` = Owner (can edit/add records)

4. **Related Records:** The response includes latest 10 records for:
   - Mating
   - Breeding
   - Weight
   - Vaccines
   - Treatments

---

## 🔗 Related Endpoints

- `POST /api/animal/addanimal` - Creates animal with auto-generated QR token
- `GET /api/animal/getallanimals` - Get all animals (includes qrToken)
- `GET /api/animal/getsinglanimals/:tagId` - Get single animal (includes qrToken)




