# Sales Rep Product Pricing - Implementation Plan

## Overview
This document outlines the step-by-step implementation plan for the Sales Rep Product Pricing feature. The implementation is divided into two phases to ensure manageable development and testing.

---

## Phase 1: Inventory Management (CRUD Operations)

**Goal**: Allow admins and sales reps to manage custom product prices.

### Step 1.1: Create Controller File
**File**: `controllers/admin/salesRepProductPriceController.js`

**Actions**:
- Create new controller file following the pattern from `productController.js`
- Import required models: `salesRepProductPrice`, `product`, `salesRep`
- Import utilities: `catchAsync`, `AppError`, `factory`, `APIFeatures`

**Functions to implement**:
1. `getAllSalesRepProductPrices` - Get all pricing entries (with filters)
2. `getSalesRepProductPrice` - Get single pricing entry by ID
3. `getPricesBySalesRep` - Get all prices for a specific sales rep
4. `getPricesByProduct` - Get all prices for a specific product
5. `createSalesRepProductPrice` - Create new pricing entry
6. `updateSalesRepProductPrice` - Update existing pricing entry
7. `deleteSalesRepProductPrice` - Soft delete pricing entry
8. `bulkCreateSalesRepProductPrices` - Bulk create prices (optional)

### Step 1.2: Implement GET All Prices
**Function**: `getAllSalesRepProductPrices`

**Requirements**:
- Use `APIFeatures` for filtering, sorting, pagination
- Include associations: `product` and `salesRep`
- Filter by `status` and `deleted` (default: show only active, non-deleted)
- Searchable fields: product name, sales rep name
- Return: `id`, `productId`, `salesRepId`, `price`, `status`, `createdAt`, `updatedAt`
- Include product details: `name`, `sku`, `productCode`
- Include sales rep details: `srName`, `email`, `territoryName`

**Query Parameters**:
- `salesRepId` - Filter by sales rep
- `productId` - Filter by product
- `status` - Filter by status
- `search` - Search in product name or sales rep name
- Standard pagination: `page`, `limit`, `sort`

### Step 1.3: Implement GET Single Price
**Function**: `getSalesRepProductPrice`

**Requirements**:
- Get by ID from `req.params.id`
- Include full associations: `product` and `salesRep`
- Return 404 if not found
- Exclude `deleted` and `deletedAt` from response

### Step 1.4: Implement GET Prices by Sales Rep
**Function**: `getPricesBySalesRep`

**Route**: `GET /api/v1/admin/sales-rep-product-price/sales-rep/:salesRepId`

**Requirements**:
- Get all prices for a specific sales rep
- Include product details
- Support pagination and filtering
- Return empty array if no prices found (not an error)

### Step 1.5: Implement GET Prices by Product
**Function**: `getPricesByProduct`

**Route**: `GET /api/v1/admin/sales-rep-product-price/product/:productId`

**Requirements**:
- Get all prices for a specific product
- Include sales rep details
- Support pagination and filtering
- Return empty array if no prices found (not an error)

### Step 1.6: Implement CREATE Price
**Function**: `createSalesRepProductPrice`

**Route**: `POST /api/v1/admin/sales-rep-product-price`

**Request Body**:
```json
{
  "productId": 1,
  "salesRepId": 2,
  "price": 150.00,
  "status": true
}
```

**Validation**:
- `productId` - Required, must exist in `products` table
- `salesRepId` - Required, must exist in `salesReps` table
- `price` - Required, must be positive number, DECIMAL(20,2)
- `status` - Optional, boolean, default: true
- Check for duplicate: `productId + salesRepId` combination must be unique

**Logic**:
1. Validate input fields
2. Check if product exists
3. Check if sales rep exists
4. Check if pricing entry already exists (unique constraint)
5. If exists, return error or update (based on requirement)
6. Create new entry
7. Return created entry with associations

### Step 1.7: Implement UPDATE Price
**Function**: `updateSalesRepProductPrice`

**Route**: `PATCH /api/v1/admin/sales-rep-product-price/:id`

**Request Body**:
```json
{
  "price": 160.00,
  "status": true
}
```

**Validation**:
- `price` - Optional, must be positive if provided
- `status` - Optional, boolean
- Cannot update `productId` or `salesRepId` (immutable)

**Logic**:
1. Find entry by ID
2. Return 404 if not found
3. Validate price if provided
4. Update only provided fields
5. Return updated entry with associations

### Step 1.8: Implement DELETE Price
**Function**: `deleteSalesRepProductPrice`

**Route**: `DELETE /api/v1/admin/sales-rep-product-price/:id`

**Logic**:
- Use soft delete: set `deleted = true`
- Use `factory.softdelete` pattern
- Return success message

### Step 1.9: Add Routes
**File**: `routes/adminRoutes.js`

**Routes to add**:
```javascript
const salesRepProductPriceController = require("../controllers/admin/salesRepProductPriceController");

// Get all prices
router.get(
  "/sales-rep-product-price",
  protect,
  salesRepProductPriceController.getAllSalesRepProductPrices
);

// Get prices by sales rep
router.get(
  "/sales-rep-product-price/sales-rep/:salesRepId",
  protect,
  salesRepProductPriceController.getPricesBySalesRep
);

// Get prices by product
router.get(
  "/sales-rep-product-price/product/:productId",
  protect,
  salesRepProductPriceController.getPricesByProduct
);

// Get single price
router.get(
  "/sales-rep-product-price/:id",
  protect,
  salesRepProductPriceController.getSalesRepProductPrice
);

// Create price
router.post(
  "/sales-rep-product-price",
  protect,
  salesRepProductPriceController.createSalesRepProductPrice
);

// Update price
router.patch(
  "/sales-rep-product-price/:id",
  protect,
  salesRepProductPriceController.updateSalesRepProductPrice
);

// Delete price
router.delete(
  "/sales-rep-product-price/:id",
  protect,
  salesRepProductPriceController.deleteSalesRepProductPrice
);
```

### Step 1.10: Testing Phase 1
**Test Cases**:
1. ✅ Create price for product + sales rep
2. ✅ Try to create duplicate (should fail)
3. ✅ Get all prices with filters
4. ✅ Get prices by sales rep
5. ✅ Get prices by product
6. ✅ Update price
7. ✅ Soft delete price
8. ✅ Verify associations load correctly
9. ✅ Test pagination and sorting
10. ✅ Test search functionality

---

## Phase 2: Order Creation & Update

**Goal**: Use sales rep pricing when creating/updating orders.

### Step 2.1: Create Helper Function
**File**: `services/productPriceService.js` (new file)

**Function**: `getEffectiveProductPrice(productId, salesRepId)`

**Purpose**: Get the effective price for a product (sales rep price if exists, otherwise base price)

**Logic**:
```javascript
async function getEffectiveProductPrice({ productId, salesRepId }) {
  // 1. If salesRepId provided, check for custom price
  if (salesRepId) {
    const customPrice = await salesRepProductPrice.findOne({
      where: {
        productId,
        salesRepId,
        status: true,
        deleted: false,
      },
      include: [{ model: product }],
    });
    
    if (customPrice) {
      return {
        price: customPrice.price,
        source: 'salesRep',
        salesRepPriceId: customPrice.id,
      };
    }
  }
  
  // 2. Fallback to base product price
  const baseProduct = await product.findOne({
    where: { id: productId },
    attributes: ['id', 'price'],
  });
  
  if (!baseProduct) {
    throw new AppError('Product not found', 404);
  }
  
  return {
    price: baseProduct.price,
    source: 'base',
  };
}
```

**Export**: Export this function for use in order controllers

### Step 2.2: Update Order Creation - Customer Orders
**File**: `controllers/customer/orderController.js`

**Function**: `bookOrder` (around line 388)

**Changes Required**:
1. After fetching products (line 425), get customer's salesRepId
2. For each product, call `getEffectiveProductPrice(productId, salesRepId)`
3. Use the effective price instead of `obj.price`
4. Store the effective price in `element.price` (already exists in item model)

**Code Location**: Around line 482 where `element.price = obj.price * qty;`

**New Logic**:
```javascript
// After fetching products
const products = await product.findAll({ ... });

// Get effective prices for all products
const effectivePrices = await Promise.all(
  products.map(async (obj) => {
    const priceInfo = await getEffectiveProductPrice({
      productId: obj.id,
      salesRepId: customer?.salesRepId,
    });
    return {
      productId: obj.id,
      price: priceInfo.price,
      source: priceInfo.source,
    };
  })
);

// Create price map for quick lookup
const priceMap = new Map(
  effectivePrices.map(p => [p.productId, p.price])
);

// In finalItems mapping
const finalItems = products.map((obj) => {
  // ... existing code ...
  
  // Use effective price instead of obj.price
  const effectivePrice = priceMap.get(obj.id) || obj.price;
  element.price = effectivePrice * qty;
  
  // ... rest of the code ...
});
```

### Step 2.3: Update Order Creation - Admin Orders
**File**: `controllers/admin/manageOrderController.js`

**Function**: Find the order creation function (search for order creation logic)

**Changes Required**:
- Similar to Step 2.2
- Get salesRepId from order data or customer data
- Use `getEffectiveProductPrice` for each product
- Store effective price in item.price

### Step 2.4: Update Order Update
**File**: `controllers/admin/manageOrderController.js`

**Function**: `updateOrder` (around line 1453 or search for update order)

**Changes Required**:
1. When updating order items, check if products changed
2. If products changed, recalculate prices using `getEffectiveProductPrice`
3. Update item prices with effective prices
4. Recalculate order totals

**Logic**:
```javascript
// If order items are being updated
if (input.items && input.items.length > 0) {
  // Get current order with salesRepId
  const currentOrder = await order.findOne({
    where: { id: orderId },
    include: [{ model: user, attributes: ['salesRepId'] }],
  });
  
  // Update each item with effective price
  for (const item of input.items) {
    if (item.productId) {
      const priceInfo = await getEffectiveProductPrice({
        productId: item.productId,
        salesRepId: currentOrder.user?.salesRepId,
      });
      
      // Update item price
      item.price = priceInfo.price * (item.qty || 1);
    }
  }
  
  // Recalculate order totals
  // ... existing total calculation logic ...
}
```

### Step 2.5: Update QuickBooks Invoice Sync
**File**: `services/qboInvoice.js`

**Function**: `createQboInvoice` (around line 678)

**Note**: This should already work correctly because:
- Order items already have `item.price` stored with the effective price
- QBO invoice creation uses `it.total` or `it.price` from items (line 708)
- No changes needed if items are created with correct prices

**Verification**:
- Check that `order.items` includes the correct prices
- Verify QBO invoice amounts match item prices

### Step 2.6: Update Order Frequency (Recurring Orders)
**File**: `controllers/admin/orderFrequencyController.js`

**Function**: Find recurring order creation logic

**Changes Required**:
- When creating recurring orders, use `getEffectiveProductPrice`
- Store effective prices in order items
- Ensure prices are recalculated for each recurring order instance

### Step 2.7: Testing Phase 2
**Test Cases**:
1. ✅ Create order with sales rep - verify custom prices used
2. ✅ Create order without sales rep - verify base prices used
3. ✅ Create order with some products having custom prices
4. ✅ Update order - verify prices recalculated correctly
5. ✅ Verify item.price stores correct effective price
6. ✅ Verify QBO invoice uses correct prices
7. ✅ Test recurring orders use correct prices
8. ✅ Verify dashboards/reports show correct prices (from item.price)

---

## Implementation Checklist

### Phase 1: Inventory Management
- [ ] Step 1.1: Create controller file
- [ ] Step 1.2: Implement GET all prices
- [ ] Step 1.3: Implement GET single price
- [ ] Step 1.4: Implement GET prices by sales rep
- [ ] Step 1.5: Implement GET prices by product
- [ ] Step 1.6: Implement CREATE price
- [ ] Step 1.7: Implement UPDATE price
- [ ] Step 1.8: Implement DELETE price
- [ ] Step 1.9: Add routes
- [ ] Step 1.10: Test Phase 1

### Phase 2: Order Integration
- [ ] Step 2.1: Create helper function `getEffectiveProductPrice`
- [ ] Step 2.2: Update customer order creation
- [ ] Step 2.3: Update admin order creation
- [ ] Step 2.4: Update order update logic
- [ ] Step 2.5: Verify QBO invoice sync (no changes needed)
- [ ] Step 2.6: Update recurring orders
- [ ] Step 2.7: Test Phase 2

---

## Important Notes

1. **No Changes to Items Table**: The `item` table already has a `price` field. We store the effective price there, so no schema changes needed.

2. **Backward Compatibility**: 
   - Existing orders remain unchanged
   - Reports/dashboards continue to work (they read from `item.price`)
   - If no sales rep price exists, base product price is used

3. **Performance Considerations**:
   - Consider caching sales rep prices for frequently accessed products
   - Use bulk queries when processing multiple products
   - Index on `(productId, salesRepId)` already exists for fast lookups

4. **Data Integrity**:
   - Unique constraint prevents duplicate pricing entries
   - Foreign keys ensure referential integrity
   - Soft deletes preserve historical data

5. **Future Enhancements**:
   - Bulk import/export of sales rep prices
   - Price history/audit trail
   - Price templates for sales reps
   - Automatic price updates based on rules

---

## API Endpoints Summary

### Phase 1 Endpoints
- `GET /api/v1/admin/sales-rep-product-price` - Get all prices
- `GET /api/v1/admin/sales-rep-product-price/:id` - Get single price
- `GET /api/v1/admin/sales-rep-product-price/sales-rep/:salesRepId` - Get prices by sales rep
- `GET /api/v1/admin/sales-rep-product-price/product/:productId` - Get prices by product
- `POST /api/v1/admin/sales-rep-product-price` - Create price
- `PATCH /api/v1/admin/sales-rep-product-price/:id` - Update price
- `DELETE /api/v1/admin/sales-rep-product-price/:id` - Delete price

---

## Next Steps After Implementation

1. Create frontend UI for managing sales rep prices
2. Add validation rules (e.g., minimum/maximum price limits)
3. Add price change notifications
4. Create reports showing price differences
5. Add bulk operations for price management
