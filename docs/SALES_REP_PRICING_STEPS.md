# Sales Rep Product Pricing - Sequential Implementation Steps

## How to Use This Document
1. Review each step
2. Approve the step
3. Implement the step
4. Test the step
5. Move to the next step

---

## PHASE 1: INVENTORY MANAGEMENT

### Step 1: Create Controller File Structure
**File**: `controllers/admin/salesRepProductPriceController.js`

**Action**: Create the controller file with basic structure and imports

**Code to create**:
```javascript
const {
  salesRepProductPrice,
  product,
  salesRep,
} = require("../../models");
const catchAsync = require("../../utils/catchAsync");
const AppError = require("../../utils/appError");
const factory = require("../handlerFactory");
const APIFeatures = require("../../utils/apiFeatures");

// Controller functions will be added in subsequent steps
```

**Check**: File created with imports

---

### Step 2: Implement GET All Prices
**Function**: `getAllSalesRepProductPrices`

**Action**: Add function to get all pricing entries with filters, pagination, and associations

**Requirements**:
- Use APIFeatures for filtering, sorting, pagination
- Include `product` and `salesRep` associations
- Default filter: `status: true, deleted: false`
- Searchable: product name, sales rep name
- Query params: `salesRepId`, `productId`, `status`, `search`, `page`, `limit`, `sort`

**Check**: Function returns paginated list with associations

---

### Step 3: Implement GET Single Price
**Function**: `getSalesRepProductPrice`

**Action**: Add function to get one pricing entry by ID

**Requirements**:
- Get by `req.params.id`
- Include full `product` and `salesRep` associations
- Return 404 if not found
- Exclude `deleted` and `deletedAt` from response

**Check**: Function returns single entry with associations or 404

---

### Step 4: Implement GET Prices by Sales Rep
**Function**: `getPricesBySalesRep`

**Action**: Add function to get all prices for a specific sales rep

**Requirements**:
- Get by `req.params.salesRepId`
- Include `product` association
- Support pagination
- Return empty array if none found (not error)

**Check**: Function returns prices for sales rep

---

### Step 5: Implement GET Prices by Product
**Function**: `getPricesByProduct`

**Action**: Add function to get all prices for a specific product

**Requirements**:
- Get by `req.params.productId`
- Include `salesRep` association
- Support pagination
- Return empty array if none found (not error)

**Check**: Function returns prices for product

---

### Step 6: Implement CREATE Price
**Function**: `createSalesRepProductPrice`

**Action**: Add function to create new pricing entry

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
- `productId` - Required, must exist
- `salesRepId` - Required, must exist
- `price` - Required, positive number
- Check duplicate: `productId + salesRepId` must be unique
- Return error if duplicate exists

**Check**: Function creates entry or returns validation error

---

### Step 7: Implement UPDATE Price
**Function**: `updateSalesRepProductPrice`

**Action**: Add function to update existing pricing entry

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
- Cannot update `productId` or `salesRepId`
- Return 404 if not found

**Check**: Function updates entry or returns 404

---

### Step 8: Implement DELETE Price
**Function**: `deleteSalesRepProductPrice`

**Action**: Add function to soft delete pricing entry

**Logic**:
- Use `factory.softdelete(salesRepProductPrice)`
- Sets `deleted = true`

**Check**: Function soft deletes entry

---

### Step 9: Add Routes to adminRoutes.js
**File**: `routes/adminRoutes.js`

**Action**: Add all routes for sales rep product pricing

**Routes to add**:
```javascript
const salesRepProductPriceController = require("../controllers/admin/salesRepProductPriceController");

router.get(
  "/sales-rep-product-price",
  protect,
  salesRepProductPriceController.getAllSalesRepProductPrices
);

router.get(
  "/sales-rep-product-price/sales-rep/:salesRepId",
  protect,
  salesRepProductPriceController.getPricesBySalesRep
);

router.get(
  "/sales-rep-product-price/product/:productId",
  protect,
  salesRepProductPriceController.getPricesByProduct
);

router.get(
  "/sales-rep-product-price/:id",
  protect,
  salesRepProductPriceController.getSalesRepProductPrice
);

router.post(
  "/sales-rep-product-price",
  protect,
  salesRepProductPriceController.createSalesRepProductPrice
);

router.patch(
  "/sales-rep-product-price/:id",
  protect,
  salesRepProductPriceController.updateSalesRepProductPrice
);

router.delete(
  "/sales-rep-product-price/:id",
  protect,
  salesRepProductPriceController.deleteSalesRepProductPrice
);
```

**Check**: All routes added and accessible

---

### Step 10: Test Phase 1 - Basic CRUD
**Action**: Test all endpoints manually or with Postman

**Test Cases**:
1. ✅ POST - Create price
2. ✅ POST - Try duplicate (should fail)
3. ✅ GET - Get all prices
4. ✅ GET - Get by ID
5. ✅ GET - Get by sales rep
6. ✅ GET - Get by product
7. ✅ PATCH - Update price
8. ✅ DELETE - Soft delete
9. ✅ Verify associations load
10. ✅ Test pagination and filters

**Check**: All tests pass

---

## PHASE 2: ORDER INTEGRATION

### Step 11: Create Helper Service Function
**File**: `services/productPriceService.js` (new file)

**Function**: `getEffectiveProductPrice`

**Action**: Create service function that returns effective price (sales rep price or base price)

**Logic**:
- If `salesRepId` provided, check for custom price
- If custom price exists and is active, return it
- Otherwise, return base product price
- Throw error if product not found

**Check**: Function returns correct price based on sales rep

---

### Step 12: Update Customer Order Creation
**File**: `controllers/customer/orderController.js`

**Function**: `bookOrder` (around line 388)

**Action**: Modify order creation to use effective prices

**Changes**:
1. After fetching products (line 425)
2. Get effective prices for all products using `getEffectiveProductPrice`
3. Replace `obj.price` with effective price in `finalItems` mapping (around line 482)
4. Store effective price in `element.price`

**Check**: Orders created with correct prices (sales rep or base)

---

### Step 13: Update Admin Order Creation
**File**: `controllers/admin/manageOrderController.js`

**Function**: Find order creation function

**Action**: Modify admin order creation to use effective prices

**Changes**:
- Similar to Step 12
- Get `salesRepId` from order/customer data
- Use `getEffectiveProductPrice` for each product
- Store effective price in `item.price`

**Check**: Admin orders created with correct prices

---

### Step 14: Update Order Update Logic
**File**: `controllers/admin/manageOrderController.js`

**Function**: `updateOrder` (around line 1453)

**Action**: Modify order update to recalculate prices

**Changes**:
1. When items are updated
2. Get order with `salesRepId`
3. Recalculate prices using `getEffectiveProductPrice`
4. Update item prices
5. Recalculate order totals

**Check**: Order updates recalculate prices correctly

---

### Step 15: Verify QBO Invoice Sync
**File**: `services/qboInvoice.js`

**Function**: `createQboInvoice` (around line 678)

**Action**: Verify no changes needed (should work automatically)

**Verification**:
- Check that `order.items` has correct prices in `item.price`
- Verify QBO invoice uses `it.total` or `it.price` from items
- Test invoice creation with sales rep pricing

**Check**: QBO invoices show correct amounts

---

### Step 16: Update Recurring Orders
**File**: `controllers/admin/orderFrequencyController.js`

**Function**: Find recurring order creation logic

**Action**: Modify recurring orders to use effective prices

**Changes**:
- Use `getEffectiveProductPrice` when creating recurring orders
- Store effective prices in order items
- Ensure prices recalculated for each instance

**Check**: Recurring orders use correct prices

---

### Step 17: Test Phase 2 - Order Integration
**Action**: Test order creation and updates with sales rep pricing

**Test Cases**:
1. ✅ Create order with sales rep - custom prices used
2. ✅ Create order without sales rep - base prices used
3. ✅ Create order with mixed pricing (some custom, some base)
4. ✅ Update order - prices recalculated
5. ✅ Verify `item.price` stores correct value
6. ✅ QBO invoice shows correct amounts
7. ✅ Recurring orders use correct prices
8. ✅ Dashboards/reports show correct prices

**Check**: All order tests pass

---

## COMPLETION CHECKLIST

### Phase 1: Inventory Management
- [ ] Step 1: Controller file created
- [ ] Step 2: GET all prices implemented
- [ ] Step 3: GET single price implemented
- [ ] Step 4: GET prices by sales rep implemented
- [ ] Step 5: GET prices by product implemented
- [ ] Step 6: CREATE price implemented
- [ ] Step 7: UPDATE price implemented
- [ ] Step 8: DELETE price implemented
- [ ] Step 9: Routes added
- [ ] Step 10: Phase 1 tested

### Phase 2: Order Integration
- [ ] Step 11: Helper service function created
- [ ] Step 12: Customer order creation updated
- [ ] Step 13: Admin order creation updated
- [ ] Step 14: Order update logic updated
- [ ] Step 15: QBO invoice sync verified
- [ ] Step 16: Recurring orders updated
- [ ] Step 17: Phase 2 tested

---

## Notes

- Complete Phase 1 before starting Phase 2
- Test each step before moving to the next
- Keep existing functionality working
- No changes to `items` table schema needed
- All prices stored in existing `item.price` field
