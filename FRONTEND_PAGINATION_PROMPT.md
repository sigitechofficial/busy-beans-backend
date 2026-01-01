# Frontend Pagination Implementation Prompt

## For Frontend Developer / AI Agent

The backend API already has pagination implemented. You need to implement the frontend pagination UI and logic to consume it properly.

### API Endpoint Details

**Endpoint:** The order listing endpoint (typically `/api/v1/admin/orders` or similar based on your route configuration)

**Method:** GET

### Query Parameters for Pagination

The API accepts the following query parameters:

- **`page`** (number, optional): Current page number. Defaults to `1` if not provided.
- **`limit`** (number, optional): Number of items per page. Defaults to `10` if not provided.

**Example API Call:**

```
GET /api/v1/admin/orders?page=1&limit=10
GET /api/v1/admin/orders?page=2&limit=20
```

### API Response Structure

The API returns data in the following format:

```json
{
  "status": "success",
  "results": 10,
  "pagination": {
    "page": 1,
    "limit": 10,
    "totalItems": 94,
    "totalPages": 10
  },
  "data": {
    "data": [
      // Array of order objects
    ]
  }
}
```

**Response Fields:**

- `status`: Always "success" for successful requests
- `results`: Number of items returned in the current page (this is the length of the data array, not total count)
- `pagination`: Pagination metadata object containing:
  - `page`: Current page number
  - `limit`: Number of items per page
  - `totalItems`: Total number of items across all pages
  - `totalPages`: Total number of pages available
- `data.data`: Array containing the actual order items for the current page

### Pagination Logic

The backend pagination works as follows:

- **Page numbering starts at 1** (not 0)
- If `page=1` and `limit=10`, it returns items 1-10 (offset = 0)
- If `page=2` and `limit=10`, it returns items 11-20 (offset = 10)
- Formula: `offset = (page - 1) * limit`

**Pagination Metadata:** The API response includes a `pagination` object with all the information you need:

- `totalItems`: Total number of records available
- `totalPages`: Total number of pages
- `page`: Current page number
- `limit`: Items per page

You can use this to implement pagination controls like:

- "Page X of Y" display
- Disable Next button when `page >= totalPages`
- Disable Previous button when `page <= 1`
- Show total count: "Showing 1-10 of 94 items"

### Frontend Implementation Requirements

Implement the following:

1. **State Management:**

   - Maintain current `page` state (start with page 1)
   - Maintain `limit` state (default to 10 or allow user to select)
   - Store the fetched orders data

2. **API Integration:**

   - Append `page` and `limit` query parameters to your API calls
   - Update the API call whenever page or limit changes

3. **Pagination UI Components:**

   - Previous/Next buttons (disable Previous when `pagination.page <= 1`, disable Next when `pagination.page >= pagination.totalPages`)
   - Page number display (showing current page and total pages: "Page X of Y")
   - Total items display (e.g., "Showing 1-10 of 94 items")
   - Optional: Page size selector (dropdown to change limit: 10, 20, 50, 100)
   - Optional: Direct page input field or numbered page buttons

4. **User Experience:**

   - Show loading state while fetching new page
   - Reset to page 1 when filters/search changes
   - Preserve pagination state in URL query params if possible (for bookmarking/sharing)
   - Handle edge cases (empty results, API errors)

5. **Example Implementation Pattern:**

```javascript
// Pseudocode example
const [currentPage, setCurrentPage] = useState(1);
const [limit, setLimit] = useState(10);
const [orders, setOrders] = useState([]);
const [loading, setLoading] = useState(false);

const fetchOrders = async (page, limit) => {
  setLoading(true);
  const response = await api.get(`/orders?page=${page}&limit=${limit}`);
  setOrders(response.data.data.data);
  setPagination(response.data.pagination); // Store pagination metadata
  setLoading(false);
};

// Handle page change
const handlePageChange = (newPage) => {
  setCurrentPage(newPage);
  fetchOrders(newPage, limit);
};

// Handle limit change
const handleLimitChange = (newLimit) => {
  setLimit(newLimit);
  setCurrentPage(1); // Reset to first page
  fetchOrders(1, newLimit);
};
```

### Important Notes

- **Pagination metadata provided:** The API response includes a `pagination` object with `totalItems`, `totalPages`, `page`, and `limit`. Use this data directly to build your pagination UI.

- **First page is 1:** Remember that page numbering starts at 1, not 0.

- **Existing filters:** Make sure pagination works alongside any existing filters, sorting, or search functionality. Reset to page 1 when filters change.

- **Example pagination logic:**

  ```javascript
  // Disable Previous button
  const isFirstPage = pagination.page <= 1;

  // Disable Next button
  const isLastPage = pagination.page >= pagination.totalPages;

  // Calculate items range
  const startItem = (pagination.page - 1) * pagination.limit + 1;
  const endItem = Math.min(
    pagination.page * pagination.limit,
    pagination.totalItems
  );
  // Display: "Showing 1-10 of 94 items"
  ```

---

**Ready to implement?** Start by adding page/limit query params to your existing API calls, then build the pagination controls UI.
