# Frontend Implementation Guide: Sales Rep Product Pricing

## Overview
This feature allows sales representatives to set custom prices for products. The frontend needs to provide an interface for managing these custom prices through a complete CRUD workflow.

## Feature Flow

### Main Flow
1. **View Products** → Select products from inventory
2. **Set Custom Prices** → Assign prices for selected products
3. **Manage Prices** → View, edit, or delete existing custom prices
4. **Use in Orders** → Custom prices are automatically applied when creating/updating orders (Phase 2)

---

## API Endpoints

### Base URL
```
/api/v1/admin/sales-rep-product-price
```

### Authentication
All endpoints require authentication token in headers:
```
Authorization: Bearer <token>
```

---

## 1. GET - Fetch All Sales Rep Product Prices

**Endpoint:** `GET /api/v1/admin/sales-rep-product-price`

**Query Parameters:**
- `productId` (optional) - Filter by product ID
- `salesRepId` (optional) - Filter by sales rep ID
- `status` (optional) - Filter by status (true/false)
- `page` (optional) - Page number for pagination
- `limit` (optional) - Items per page
- `sort` (optional) - Sort field and order (e.g., "price,asc" or "-createdAt")
- `fields` (optional) - Select specific fields (comma-separated)

**Example Request:**
```javascript
// Get all prices for a specific sales rep
GET /api/v1/admin/sales-rep-product-price?salesRepId=2&status=true&page=1&limit=20

// Get prices for a specific product
GET /api/v1/admin/sales-rep-product-price?productId=1

// Get all active prices with pagination
GET /api/v1/admin/sales-rep-product-price?status=true&page=1&limit=10&sort=-createdAt
```

**Response:**
```json
{
  "status": "success",
  "results": 10,
  "pagination": {
    "currentPage": 1,
    "totalPages": 3,
    "totalItems": 25,
    "itemsPerPage": 10
  },
  "data": {
    "data": [
      {
        "id": 1,
        "productId": 1,
        "salesRepId": 2,
        "price": "150.00",
        "status": true,
        "createdAt": "2025-01-27T10:00:00.000Z",
        "updatedAt": "2025-01-27T10:00:00.000Z",
        "product": {
          "id": 1,
          "name": "Premium Coffee Beans",
          "sku": "SKU123",
          "productCode": "PC123",
          "price": "100.00"
        },
        "salesRep": {
          "id": 2,
          "srName": "John Doe",
          "email": "john@example.com",
          "territoryName": "North Territory"
        }
      }
    ]
  }
}
```

---

## 2. GET - Fetch Single Price by ID

**Endpoint:** `GET /api/v1/admin/sales-rep-product-price/:id`

**Example Request:**
```javascript
GET /api/v1/admin/sales-rep-product-price/123
```

**Response:**
```json
{
  "status": "success",
  "data": {
    "data": {
      "id": 123,
      "productId": 1,
      "salesRepId": 2,
      "price": "150.00",
      "status": true,
      "product": { ... },
      "salesRep": { ... }
    }
  }
}
```

---

## 3. POST - Create Sales Rep Product Prices (Bulk)

**Endpoint:** `POST /api/v1/admin/sales-rep-product-price`

**Request Body:** Array of pricing entries
```json
[
  {
    "productId": 1,
    "salesRepId": 2,
    "price": 150.00,
    "status": true
  },
  {
    "productId": 3,
    "salesRepId": 2,
    "price": 200.00,
    "status": true
  }
]
```

**Required Fields:**
- `productId` (integer) - Product ID
- `salesRepId` (integer) - Sales Rep ID
- `price` (number) - Custom price (must be positive)

**Optional Fields:**
- `status` (boolean) - Active status (default: true)

**Notes:**
- Duplicate `productId + salesRepId` combinations in the same request are automatically removed (first occurrence kept)
- If a pricing entry already exists in database, returns 409 error

**Response (201 Created):**
```json
{
  "status": "success",
  "data": {}
}
```

**Error Responses:**
- `400` - Validation error (missing fields, invalid price, etc.)
- `404` - Product or Sales Rep not found
- `409` - Pricing entry already exists

---

## 4. PATCH - Update Sales Rep Product Prices (Bulk)

**Endpoint:** `PATCH /api/v1/admin/sales-rep-product-price`

**Request Body:** Array of pricing entries to update
```json
[
  {
    "productId": 1,
    "salesRepId": 2,
    "price": 175.00,
    "status": true
  },
  {
    "productId": 3,
    "salesRepId": 2,
    "price": 250.00
  }
]
```

**Required Fields:**
- `productId` (integer) - Product ID
- `salesRepId` (integer) - Sales Rep ID

**Optional Fields:**
- `price` (number) - New price (if provided, must be positive)
- `status` (boolean) - New status

**Notes:**
- Only provided fields will be updated
- Duplicate combinations are automatically removed
- If entry doesn't exist, it's skipped (warning in response)

**Response (200 OK):**
```json
{
  "status": "success",
  "results": 2,
  "data": {
    "data": [
      {
        "id": 1,
        "productId": 1,
        "salesRepId": 2,
        "price": "175.00",
        "status": true,
        "product": { ... },
        "salesRep": { ... }
      }
    ]
  }
}
```

**Response with warnings:**
```json
{
  "status": "success",
  "results": 1,
  "warning": "1 entry/entries not found and were skipped. Use create endpoint to add them.",
  "missingEntries": [
    { "productId": 5, "salesRepId": 2 }
  ],
  "data": { ... }
}
```

---

## 5. DELETE - Delete Single Price

**Endpoint:** `DELETE /api/v1/admin/sales-rep-product-price/:id`

**Example Request:**
```javascript
DELETE /api/v1/admin/sales-rep-product-price/123
```

**Response (200 OK):**
```json
{
  "status": "success",
  "data": {
    "data": [1]
  }
}
```

---

## 6. DELETE - Bulk Delete Prices

**Endpoint:** `DELETE /api/v1/admin/sales-rep-product-price`

**Request Body:** Array of entries to delete (supports two formats)

**Format 1 - By ID:**
```json
[
  { "id": 1 },
  { "id": 2 },
  { "id": 3 }
]
```

**Format 2 - By Product + Sales Rep:**
```json
[
  { "productId": 1, "salesRepId": 2 },
  { "productId": 3, "salesRepId": 2 }
]
```

**Mixed Format:**
```json
[
  { "id": 1 },
  { "productId": 3, "salesRepId": 2 }
]
```

**Response (200 OK):**
```json
{
  "status": "success",
  "results": 2,
  "message": "Successfully deleted 2 pricing entry/entries",
  "data": {
    "deletedIds": [1, 2]
  }
}
```

---

## Frontend Implementation Steps

### Step 1: Create API Service Functions

Create a service file (e.g., `salesRepProductPriceService.js`):

```javascript
// Example structure
const API_BASE = '/api/v1/admin/sales-rep-product-price';

export const salesRepProductPriceService = {
  // Get all prices with filters
  getAll: async (filters = {}) => {
    const queryParams = new URLSearchParams(filters).toString();
    const response = await fetch(`${API_BASE}?${queryParams}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  },

  // Get single price
  getById: async (id) => {
    const response = await fetch(`${API_BASE}/${id}`, {
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  },

  // Create prices (bulk)
  create: async (pricesArray) => {
    const response = await fetch(API_BASE, {
      method: 'POST',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pricesArray)
    });
    return response.json();
  },

  // Update prices (bulk)
  update: async (pricesArray) => {
    const response = await fetch(API_BASE, {
      method: 'PATCH',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(pricesArray)
    });
    return response.json();
  },

  // Delete single price
  delete: async (id) => {
    const response = await fetch(`${API_BASE}/${id}`, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      }
    });
    return response.json();
  },

  // Bulk delete
  bulkDelete: async (entriesArray) => {
    const response = await fetch(API_BASE, {
      method: 'DELETE',
      headers: {
        'Authorization': `Bearer ${token}`,
        'Content-Type': 'application/json'
      },
      body: JSON.stringify(entriesArray)
    });
    return response.json();
  }
};
```

---

### Step 2: Main Pricing Management Page

**Page Structure:**
```
Sales Rep Product Pricing Management
├── Header Section
│   ├── Title: "Sales Rep Product Pricing"
│   ├── Filter Bar
│   │   ├── Sales Rep Selector (dropdown)
│   │   ├── Product Search/Filter
│   │   ├── Status Toggle (Active/Inactive/All)
│   │   └── Search Input
│   └── Action Buttons
│       ├── "Add New Prices" (opens modal/page)
│       └── "Bulk Actions" (edit/delete selected)
│
├── Products List Section
│   ├── Table/Grid View
│   │   ├── Checkbox column (for bulk selection)
│   │   ├── Product Info (name, SKU, code)
│   │   ├── Default Price
│   │   ├── Custom Price (editable)
│   │   ├── Status Badge
│   │   ├── Sales Rep Info
│   │   └── Actions (Edit, Delete)
│   └── Pagination Controls
│
└── Footer/Summary Section
    └── Total items, selected count, etc.
```

---

### Step 3: Add/Edit Pricing Modal/Page

**Flow:**
1. **Product Selection**
   - Show list of products (from inventory)
   - Allow multi-select with checkboxes
   - Show product details (name, SKU, default price)
   - Filter/search products

2. **Price Input Form**
   - For each selected product:
     - Product name (read-only)
     - Default price (read-only, for reference)
     - Custom price input (required, number, min: 0)
     - Status toggle (default: active)
   - Show total count of products selected

3. **Sales Rep Selection**
   - If not pre-selected, show sales rep dropdown
   - Display selected sales rep info

4. **Submit Actions**
   - Validate all prices are positive numbers
   - Show loading state
   - Call create API
   - Show success/error messages
   - Refresh main list

**Form Validation:**
- All selected products must have a price
- Price must be a positive number
- Sales rep must be selected
- Show validation errors inline

---

### Step 4: Price List/Table View

**Table Columns:**
1. **Checkbox** - For bulk selection
2. **Product Name** - Clickable, links to product details
3. **Product SKU/Code** - For reference
4. **Default Price** - Original product price (read-only)
5. **Custom Price** - Editable inline or via modal
6. **Status** - Badge (Active/Inactive) with toggle
7. **Sales Rep** - Name and territory
8. **Last Updated** - Date/time
9. **Actions** - Edit, Delete buttons

**Features:**
- Inline editing for price (double-click or edit button)
- Quick status toggle
- Row selection for bulk operations
- Sortable columns
- Filterable by sales rep, product, status

---

### Step 5: Bulk Operations

**Bulk Edit:**
- Select multiple rows
- Click "Bulk Edit"
- Modal shows:
  - Selected items count
  - Option to update price (same for all or individual)
  - Option to update status
- Submit updates all selected items

**Bulk Delete:**
- Select multiple rows
- Click "Delete Selected"
- Show confirmation dialog with count
- Call bulk delete API
- Refresh list

---

### Step 6: Integration with Product Selection (for Orders)

**When creating/updating orders:**
1. User selects products
2. System checks if custom price exists for:
   - Selected product
   - Current sales rep (from order context)
3. If custom price exists:
   - Use custom price
   - Show indicator (e.g., "Custom Price" badge)
   - Display both default and custom price for comparison
4. If no custom price:
   - Use default product price

**UI Indicators:**
- Badge: "Custom Price" or "Default Price"
- Tooltip showing price source
- Visual distinction (color, icon)

---

## UI/UX Recommendations

### Visual Design
- **Color Coding:**
  - Active prices: Green badge
  - Inactive prices: Gray badge
  - Custom price indicator: Blue/Orange accent
- **Icons:**
  - Edit: Pencil icon
  - Delete: Trash icon
  - Custom price: Star or tag icon
  - Status toggle: Toggle switch

### User Experience
1. **Loading States:**
   - Show skeleton loaders while fetching
   - Disable buttons during API calls
   - Show progress indicators for bulk operations

2. **Error Handling:**
   - Display user-friendly error messages
   - Show validation errors inline
   - Handle network errors gracefully
   - Retry mechanism for failed requests

3. **Success Feedback:**
   - Toast notifications for successful operations
   - Confirmation dialogs for destructive actions
   - Auto-refresh list after create/update/delete

4. **Performance:**
   - Implement pagination for large lists
   - Debounce search/filter inputs
   - Lazy load product details
   - Cache frequently accessed data

5. **Accessibility:**
   - Keyboard navigation support
   - ARIA labels for screen readers
   - Focus management in modals
   - Clear error announcements

---

## Example Component Structure (React)

```javascript
// Main Pricing Management Component
const SalesRepProductPricing = () => {
  const [prices, setPrices] = useState([]);
  const [selectedSalesRep, setSelectedSalesRep] = useState(null);
  const [filters, setFilters] = useState({});
  const [selectedItems, setSelectedItems] = useState([]);

  // Fetch prices
  useEffect(() => {
    fetchPrices();
  }, [filters, selectedSalesRep]);

  const fetchPrices = async () => {
    const params = {
      ...filters,
      salesRepId: selectedSalesRep?.id,
      page: 1,
      limit: 20
    };
    const data = await salesRepProductPriceService.getAll(params);
    setPrices(data.data.data);
  };

  const handleBulkCreate = async (products, prices, salesRepId) => {
    const payload = products.map((product, index) => ({
      productId: product.id,
      salesRepId: salesRepId,
      price: prices[index],
      status: true
    }));
    
    try {
      await salesRepProductPriceService.create(payload);
      showSuccessToast('Prices created successfully');
      fetchPrices();
    } catch (error) {
      showErrorToast(error.message);
    }
  };

  const handleBulkUpdate = async (updates) => {
    try {
      await salesRepProductPriceService.update(updates);
      showSuccessToast('Prices updated successfully');
      fetchPrices();
    } catch (error) {
      showErrorToast(error.message);
    }
  };

  const handleBulkDelete = async () => {
    if (!confirm('Are you sure you want to delete selected items?')) return;
    
    const payload = selectedItems.map(item => ({
      id: item.id
    }));
    
    try {
      await salesRepProductPriceService.bulkDelete(payload);
      showSuccessToast('Prices deleted successfully');
      setSelectedItems([]);
      fetchPrices();
    } catch (error) {
      showErrorToast(error.message);
    }
  };

  return (
    <div className="pricing-management">
      <Header 
        selectedSalesRep={selectedSalesRep}
        onSalesRepChange={setSelectedSalesRep}
        onAddNew={() => setShowAddModal(true)}
        onBulkDelete={handleBulkDelete}
        selectedCount={selectedItems.length}
      />
      
      <PriceTable
        prices={prices}
        selectedItems={selectedItems}
        onSelectionChange={setSelectedItems}
        onPriceUpdate={handleBulkUpdate}
        onDelete={handleBulkDelete}
      />
      
      {showAddModal && (
        <AddPriceModal
          salesRepId={selectedSalesRep?.id}
          onClose={() => setShowAddModal(false)}
          onSubmit={handleBulkCreate}
        />
      )}
    </div>
  );
};
```

---

## Testing Checklist

- [ ] Fetch all prices with filters
- [ ] Create single price
- [ ] Create bulk prices
- [ ] Update single price
- [ ] Update bulk prices
- [ ] Delete single price
- [ ] Delete bulk prices
- [ ] Handle duplicate entries gracefully
- [ ] Handle validation errors
- [ ] Handle network errors
- [ ] Pagination works correctly
- [ ] Search/filter functionality
- [ ] Inline editing works
- [ ] Bulk operations work
- [ ] Integration with order creation (Phase 2)

---

## Notes for Frontend AI Agent

1. **Data Structure:**
   - Prices are linked to both `productId` and `salesRepId`
   - Each combination is unique (enforced by backend)
   - Prices can be active/inactive via `status` field
   - Soft delete via `deleted` field (filtered automatically)

2. **Error Handling:**
   - 400: Show validation errors to user
   - 404: Show "not found" message
   - 409: Show "already exists" message, suggest update instead
   - 500: Show generic error, suggest retry

3. **State Management:**
   - Consider using state management (Redux, Zustand, etc.) for:
     - Current sales rep selection
     - Selected products for pricing
     - Price list cache
     - Filter state

4. **Performance:**
   - Implement debouncing for search inputs
   - Use pagination for large lists
   - Cache product list (doesn't change often)
   - Optimize re-renders with React.memo if needed

5. **User Flow Priority:**
   - Most common: View prices → Edit price
   - Second: Add new prices for multiple products
   - Less common: Bulk delete, advanced filtering

---

## Quick Reference: API Summary

| Method | Endpoint | Purpose | Body Format |
|--------|----------|---------|-------------|
| GET | `/sales-rep-product-price` | Get all prices | Query params |
| GET | `/sales-rep-product-price/:id` | Get single price | - |
| POST | `/sales-rep-product-price` | Create prices (bulk) | Array of entries |
| PATCH | `/sales-rep-product-price` | Update prices (bulk) | Array of entries |
| DELETE | `/sales-rep-product-price/:id` | Delete single price | - |
| DELETE | `/sales-rep-product-price` | Delete prices (bulk) | Array of entries |

---

**End of Guide**
