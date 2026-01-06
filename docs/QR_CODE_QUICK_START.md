# QR Code Quick Start - Frontend

## 🚀 Installation

```bash
npm install qrcode.react react-qr-reader axios
# or for vanilla JS
npm install qrcode qr-scanner axios
```

---

## 📦 1. Display QR Code Component

```jsx
// components/AnimalQRCode.jsx
import QRCode from 'qrcode.react';

export default function AnimalQRCode({ qrToken, tagId }) {
  const qrUrl = `${window.location.origin}/scan/${qrToken}`;
  
  return (
    <div>
      <h3>QR Code for {tagId}</h3>
      <QRCode value={qrUrl} size={200} />
      <p>{qrUrl}</p>
    </div>
  );
}
```

---

## 📷 2. QR Scanner Component

```jsx
// components/QRScanner.jsx
import { QrReader } from 'react-qr-reader';
import { useState } from 'react';
import { useRouter } from 'next/router';

export default function QRScanner() {
  const [scanning, setScanning] = useState(false);
  const router = useRouter();

  const handleScan = (result) => {
    if (result) {
      const url = new URL(result.text);
      const token = url.pathname.split('/scan/')[1];
      if (token) {
        router.push(`/scan/${token}`);
      }
    }
  };

  return (
    <div>
      {scanning ? (
        <QrReader
          onResult={handleScan}
          constraints={{ facingMode: 'environment' }}
        />
      ) : (
        <button onClick={() => setScanning(true)}>Start Scan</button>
      )}
    </div>
  );
}
```

---

## 🔍 3. Scan Page (Display Animal Data)

```jsx
// pages/scan/[token].js
import { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';

export default function ScanPage() {
  const router = useRouter();
  const { token } = router.query;
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!token) return;
    
    const fetchData = async () => {
      try {
        const token = localStorage.getItem('token');
        const res = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/scan/${token}`,
          { headers: token ? { Authorization: `Bearer ${token}` } : {} }
        );
        setData(res.data.data);
      } catch (err) {
        console.error(err);
      } finally {
        setLoading(false);
      }
    };
    
    fetchData();
  }, [token]);

  if (loading) return <div>Loading...</div>;
  if (!data) return <div>Animal not found</div>;

  const { animal, permissions, records } = data;

  return (
    <div>
      <h1>Animal: {animal.tagId}</h1>
      <p>Type: {animal.animalType}</p>
      <p>Gender: {animal.gender}</p>
      {animal.breed && <p>Breed: {animal.breed.breedName}</p>}
      
      <h2>Recent Records</h2>
      {records.weight?.length > 0 && (
        <div>
          <h3>Weights</h3>
          {records.weight.map((w, i) => (
            <p key={i}>{w.weight} kg - {new Date(w.Date).toLocaleDateString()}</p>
          ))}
        </div>
      )}
      
      {permissions.canAdd && (
        <button onClick={() => router.push(`/animals/${animal.tagId}/edit`)}>
          Edit Animal
        </button>
      )}
    </div>
  );
}
```

---

## 📋 API Response Structure

```json
{
  "status": "success",
  "data": {
    "animal": {
      "_id": "...",
      "tagId": "TAG001",
      "animalType": "goat",
      "gender": "female",
      "breed": { "breedName": "Nubian" },
      "locationShed": { "locationShedName": "Shed 1" },
      "birthDate": "2024-01-01",
      "ageInDays": 365
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

## 🔗 API Endpoint

```
GET /api/scan/:token
```

- **Auth**: Optional (send token in header if user is logged in)
- **Response**: Animal data + permissions + related records

---

## ✅ Usage in Animal List

```jsx
// Show QR code button in animal list
{animal.qrToken && (
  <button onClick={() => router.push(`/animals/${animal.tagId}/qr`)}>
    View QR Code
  </button>
)}
```

---

## ✅ Usage in Animal Details

```jsx
// Show QR code in animal details page
import AnimalQRCode from '@/components/AnimalQRCode';

{animal.qrToken && (
  <AnimalQRCode qrToken={animal.qrToken} tagId={animal.tagId} />
)}
```

---

## 🎯 Key Points

1. **QR Token**: Automatically generated when animal is created
2. **QR URL Format**: `https://yourdomain.com/scan/{qrToken}`
3. **Permissions**: 
   - Owner sees full data + can edit
   - Others see basic info only
4. **No Auth Required**: Scan endpoint works without login (but shows limited data)




