# QR Code Feature - Frontend Implementation Guide

## 📋 Overview
This guide explains how to implement QR code generation and scanning features in the frontend.

## 🔧 Required Libraries

### For React/Next.js:
```bash
npm install qrcode.react react-qr-reader
# or
npm install qrcode @zxing/library
```

### For Vanilla JavaScript:
```bash
npm install qrcode qr-scanner
```

---

## 📱 Part 1: Generate QR Code (Display QR for Animal)

### React Component Example:

```jsx
import React from 'react';
import QRCode from 'qrcode.react';

const AnimalQRCode = ({ qrToken, animalTagId }) => {
  const qrLink = `${process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://mazraaonline.com'}/scan/${qrToken}`;
  
  const downloadQR = () => {
    const canvas = document.getElementById('qr-code-canvas');
    const url = canvas.toDataURL('image/png');
    const link = document.createElement('a');
    link.download = `QR-${animalTagId}.png`;
    link.href = url;
    link.click();
  };

  return (
    <div className="qr-code-container">
      <h3>Animal QR Code: {animalTagId}</h3>
      <div className="qr-code-wrapper">
        <QRCode
          id="qr-code-canvas"
          value={qrLink}
          size={256}
          level="H" // Error correction level
          includeMargin={true}
        />
      </div>
      <p className="qr-link-text">{qrLink}</p>
      <button onClick={downloadQR}>Download QR Code</button>
    </div>
  );
};

export default AnimalQRCode;
```

### Usage in Animal Details Page:

```jsx
import AnimalQRCode from './components/AnimalQRCode';

const AnimalDetails = ({ animal }) => {
  return (
    <div>
      <h2>Animal: {animal.tagId}</h2>
      {/* Other animal details */}
      
      {animal.qrToken && (
        <AnimalQRCode 
          qrToken={animal.qrToken} 
          animalTagId={animal.tagId} 
        />
      )}
    </div>
  );
};
```

---

## 📷 Part 2: Scan QR Code (Camera Scanner)

### React Component Example:

```jsx
import React, { useState } from 'react';
import { QrReader } from 'react-qr-reader';
import axios from 'axios';

const QRScanner = ({ onScanSuccess, onError }) => {
  const [scanning, setScanning] = useState(false);
  const [error, setError] = useState(null);

  const handleScan = async (result) => {
    if (result) {
      setScanning(false);
      try {
        // Extract token from QR code URL
        // QR format: https://mazraaonline.com/scan/abc123...
        const url = new URL(result.text);
        const token = url.pathname.split('/scan/')[1];
        
        if (!token) {
          throw new Error('Invalid QR code format');
        }

        // Call API to get animal data
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/scan/${token}`,
          {
            headers: {
              Authorization: `Bearer ${localStorage.getItem('token')}`, // Optional auth
            },
          }
        );

        if (response.data.status === 'success') {
          onScanSuccess(response.data.data);
        } else {
          throw new Error(response.data.message || 'Failed to fetch animal data');
        }
      } catch (err) {
        setError(err.message);
        if (onError) onError(err);
      }
    }
  };

  const handleError = (err) => {
    console.error('QR Scanner Error:', err);
    setError('Failed to access camera. Please check permissions.');
    if (onError) onError(err);
  };

  return (
    <div className="qr-scanner-container">
      <h2>Scan Animal QR Code</h2>
      
      {error && (
        <div className="error-message">
          {error}
          <button onClick={() => setError(null)}>Dismiss</button>
        </div>
      )}

      {!scanning ? (
        <button onClick={() => setScanning(true)}>
          Start Scanning
        </button>
      ) : (
        <div className="scanner-wrapper">
          <QrReader
            onResult={handleScan}
            constraints={{
              facingMode: 'environment', // Use back camera
            }}
            style={{ width: '100%', maxWidth: '500px' }}
          />
          <button onClick={() => setScanning(false)}>Stop Scanning</button>
        </div>
      )}
    </div>
  );
};

export default QRScanner;
```

---

## 🔍 Part 3: Display Scanned Animal Data

### React Component Example:

```jsx
import React from 'react';

const ScannedAnimalDetails = ({ animalData }) => {
  const { animal, permissions, records } = animalData;

  return (
    <div className="scanned-animal-details">
      <h2>Animal Information</h2>
      
      {/* Basic Info */}
      <div className="animal-basic-info">
        <p><strong>Tag ID:</strong> {animal.tagId}</p>
        <p><strong>Type:</strong> {animal.animalType}</p>
        <p><strong>Gender:</strong> {animal.gender}</p>
        {animal.breed && (
          <p><strong>Breed:</strong> {animal.breed.breedName}</p>
        )}
        {animal.locationShed && (
          <p><strong>Location:</strong> {animal.locationShed.locationShedName}</p>
        )}
        {animal.birthDate && (
          <p><strong>Birth Date:</strong> {new Date(animal.birthDate).toLocaleDateString()}</p>
        )}
        {animal.ageInDays !== undefined && (
          <p><strong>Age:</strong> {animal.ageInDays} days</p>
        )}
      </div>

      {/* Full Data (only for owner) */}
      {permissions.canAdd && (
        <div className="animal-full-data">
          {animal.purchasePrice && (
            <p><strong>Purchase Price:</strong> {animal.purchasePrice}</p>
          )}
          {animal.marketValue && (
            <p><strong>Market Value:</strong> {animal.marketValue}</p>
          )}
          {/* Add other sensitive fields */}
        </div>
      )}

      {/* Related Records */}
      <div className="animal-records">
        <h3>Recent Records</h3>
        
        {records.mating && records.mating.length > 0 && (
          <div className="record-section">
            <h4>Mating Records ({records.mating.length})</h4>
            <ul>
              {records.mating.map((m, idx) => (
                <li key={idx}>
                  Date: {new Date(m.createdAt).toLocaleDateString()}
                  {m.maleTag_id && ` - Male: ${m.maleTag_id}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {records.breeding && records.breeding.length > 0 && (
          <div className="record-section">
            <h4>Breeding Records ({records.breeding.length})</h4>
            <ul>
              {records.breeding.map((b, idx) => (
                <li key={idx}>
                  Delivery: {new Date(b.deliveryDate).toLocaleDateString()}
                  {b.numberOfBirths && ` - Births: ${b.numberOfBirths}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {records.weight && records.weight.length > 0 && (
          <div className="record-section">
            <h4>Weight Records ({records.weight.length})</h4>
            <ul>
              {records.weight.map((w, idx) => (
                <li key={idx}>
                  {new Date(w.Date).toLocaleDateString()}: {w.weight} kg
                  {w.weightType && ` (${w.weightType})`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {records.vaccines && records.vaccines.length > 0 && (
          <div className="record-section">
            <h4>Vaccine Records ({records.vaccines.length})</h4>
            <ul>
              {records.vaccines.map((v, idx) => (
                <li key={idx}>
                  {new Date(v.date).toLocaleDateString()}
                  {v.vaccine && ` - ${v.vaccine.otherVaccineName || v.vaccine.vaccineType}`}
                </li>
              ))}
            </ul>
          </div>
        )}

        {records.treatments && records.treatments.length > 0 && (
          <div className="record-section">
            <h4>Treatment Records ({records.treatments.length})</h4>
            <ul>
              {records.treatments.map((t, idx) => (
                <li key={idx}>
                  {new Date(t.date).toLocaleDateString()}
                  {t.treatments && t.treatments.length > 0 && (
                    <span> - {t.treatments.map(tr => tr.treatmentId?.name).join(', ')}</span>
                  )}
                </li>
              ))}
            </ul>
          </div>
        )}
      </div>

      {/* Action Buttons (only for owner) */}
      {permissions.canAdd && (
        <div className="action-buttons">
          <button onClick={() => window.location.href = `/animals/${animal.tagId}/edit`}>
            Edit Animal
          </button>
          <button onClick={() => window.location.href = `/animals/${animal.tagId}/weight`}>
            Add Weight
          </button>
          <button onClick={() => window.location.href = `/animals/${animal.tagId}/vaccine`}>
            Add Vaccine
          </button>
        </div>
      )}
    </div>
  );
};

export default ScannedAnimalDetails;
```

---

## 🎯 Part 4: Complete Scan Page (Route: /scan/:token)

### Next.js Page Example (`pages/scan/[token].js`):

```jsx
import React, { useEffect, useState } from 'react';
import { useRouter } from 'next/router';
import axios from 'axios';
import ScannedAnimalDetails from '../components/ScannedAnimalDetails';

const ScanPage = () => {
  const router = useRouter();
  const { token } = router.query;
  const [animalData, setAnimalData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!token) return;

    const fetchAnimalData = async () => {
      try {
        setLoading(true);
        const tokenFromStorage = localStorage.getItem('token');
        
        const response = await axios.get(
          `${process.env.NEXT_PUBLIC_API_URL}/api/scan/${token}`,
          {
            headers: tokenFromStorage
              ? { Authorization: `Bearer ${tokenFromStorage}` }
              : {},
          }
        );

        if (response.data.status === 'success') {
          setAnimalData(response.data.data);
        } else {
          setError(response.data.message || 'Failed to load animal data');
        }
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Animal not found');
      } finally {
        setLoading(false);
      }
    };

    fetchAnimalData();
  }, [token]);

  if (loading) {
    return <div>Loading animal data...</div>;
  }

  if (error) {
    return (
      <div className="error-container">
        <h2>Error</h2>
        <p>{error}</p>
        <button onClick={() => router.push('/')}>Go Home</button>
      </div>
    );
  }

  if (!animalData) {
    return <div>No animal data found</div>;
  }

  return (
    <div className="scan-page">
      <ScannedAnimalDetails animalData={animalData} />
    </div>
  );
};

export default ScanPage;
```

---

## 📱 Part 5: Manual QR Code Entry (Alternative to Scanner)

### React Component:

```jsx
import React, { useState } from 'react';
import { useRouter } from 'next/router';

const ManualQRInput = () => {
  const [qrToken, setQrToken] = useState('');
  const router = useRouter();

  const handleSubmit = (e) => {
    e.preventDefault();
    if (qrToken.trim()) {
      router.push(`/scan/${qrToken.trim()}`);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="manual-qr-input">
      <h3>Enter QR Token Manually</h3>
      <input
        type="text"
        value={qrToken}
        onChange={(e) => setQrToken(e.target.value)}
        placeholder="Enter QR token..."
        required
      />
      <button type="submit">View Animal</button>
    </form>
  );
};

export default ManualQRInput;
```

---

## 🔐 Part 6: API Integration Helper

### API Service File (`services/animalService.js`):

```javascript
import axios from 'axios';

const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:5000';

export const scanAnimalByToken = async (token, authToken = null) => {
  try {
    const headers = {};
    if (authToken) {
      headers.Authorization = `Bearer ${authToken}`;
    }

    const response = await axios.get(`${API_URL}/api/scan/${token}`, { headers });
    return response.data;
  } catch (error) {
    throw new Error(
      error.response?.data?.message || 
      'Failed to scan animal QR code'
    );
  }
};

export const getAnimalQRCode = (qrToken) => {
  const frontendUrl = process.env.NEXT_PUBLIC_FRONTEND_URL || 'https://mazraaonline.com';
  return `${frontendUrl}/scan/${qrToken}`;
};
```

---

## 🎨 Part 7: CSS Styling Example

```css
.qr-code-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  padding: 20px;
  background: #f5f5f5;
  border-radius: 8px;
  margin: 20px 0;
}

.qr-code-wrapper {
  padding: 20px;
  background: white;
  border-radius: 8px;
  box-shadow: 0 2px 8px rgba(0,0,0,0.1);
}

.qr-link-text {
  margin-top: 10px;
  font-size: 12px;
  color: #666;
  word-break: break-all;
}

.qr-scanner-container {
  max-width: 500px;
  margin: 0 auto;
  padding: 20px;
}

.scanner-wrapper {
  position: relative;
  margin: 20px 0;
}

.scanned-animal-details {
  max-width: 800px;
  margin: 0 auto;
  padding: 20px;
}

.animal-basic-info,
.animal-full-data {
  background: #f9f9f9;
  padding: 15px;
  border-radius: 8px;
  margin: 15px 0;
}

.animal-records {
  margin-top: 30px;
}

.record-section {
  background: white;
  padding: 15px;
  margin: 10px 0;
  border-radius: 8px;
  border-left: 4px solid #4CAF50;
}

.record-section ul {
  list-style: none;
  padding: 0;
}

.record-section li {
  padding: 8px;
  border-bottom: 1px solid #eee;
}

.action-buttons {
  display: flex;
  gap: 10px;
  margin-top: 20px;
}

.action-buttons button {
  padding: 10px 20px;
  background: #4CAF50;
  color: white;
  border: none;
  border-radius: 4px;
  cursor: pointer;
}

.error-container {
  text-align: center;
  padding: 40px;
  color: #d32f2f;
}
```

---

## 📝 Summary

### API Endpoint:
- **URL**: `GET /api/scan/:token`
- **Auth**: Optional (works with or without token)
- **Response**: Animal data + permissions + related records

### QR Code Format:
- **URL**: `https://mazraaonline.com/scan/{qrToken}`
- **Token**: 32-character hex string (generated automatically)

### Features:
1. ✅ Generate QR code for each animal
2. ✅ Scan QR code with camera
3. ✅ Manual token entry
4. ✅ Display animal data based on permissions
5. ✅ Show related records (mating, breeding, weight, vaccines, treatments)

### Permissions:
- **Owner**: Full data + can add/edit records
- **Non-owner/Authenticated**: Basic info only
- **Anonymous**: Basic info only

---

## 🚀 Quick Start Checklist

- [ ] Install QR code libraries
- [ ] Create QR code display component
- [ ] Create QR scanner component
- [ ] Create scan page route (`/scan/[token]`)
- [ ] Create animal details display component
- [ ] Add QR code to animal details page
- [ ] Test with real QR tokens
- [ ] Add error handling
- [ ] Style components

---

## 📞 Support

For backend API issues, check:
- `GET /api/scan/:token` endpoint
- `optionalAuth` middleware
- Animal model `qrToken` field




