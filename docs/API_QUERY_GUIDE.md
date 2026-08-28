# API Query Guide (for frontend)

Use query parameters to filter, sort, paginate, and limit fields. Column names are referred to as **field** below — replace with your actual API field names (e.g. `statusId`, `amount`, `createdAt`).

---

## Base URL (demo)

```
https://api.example.com/v1/orders
```

---

## 1. Simple filter (equality)

One field, one value (equals).

| Param        | Meaning        | Example URL |
|-------------|----------------|-------------|
| `field=value` | field equals value | `?statusId=5` |

**Demo:**  
`GET https://api.example.com/v1/orders?statusId=5`

---

## 2. Operator filters

Use **field[operator]=value** in the query string.

| Operator | Meaning        | Example (field = `amount`) |
|----------|----------------|----------------------------|
| `eq`     | equals         | `amount[eq]=100`          |
| `ne`     | not equals     | `amount[ne]=0`            |
| `gt`     | greater than   | `amount[gt]=50`           |
| `gte`    | greater or equal | `amount[gte]=50`        |
| `lt`     | less than      | `amount[lt]=200`          |
| `lte`    | less or equal  | `amount[lte]=200`         |
| `in`     | in list        | `statusId[in]=1,2,3`      |
| `notIn`  | not in list    | `statusId[notIn]=9,10`    |
| `like`   | contains       | `name[like]=coffee`       |
| `notLike`| does not contain | `name[notLike]=test`   |

**Demo URLs:**

- Amount ≥ 50:  
  `GET https://api.example.com/v1/orders?amount[gte]=50`
- Status not 6:  
  `GET https://api.example.com/v1/orders?statusId[ne]=6`
- Status in 1, 2 or 3:  
  `GET https://api.example.com/v1/orders?statusId[in]=1,2,3`
- Name contains "bean":  
  `GET https://api.example.com/v1/orders?name[like]=bean`

---

## 3. Sort

| Param   | Meaning              | Example (field = `createdAt`) |
|---------|----------------------|------------------------------|
| `sort=field`  | ascending by field   | `?sort=createdAt`            |
| `sort=-field` | descending by field  | `?sort=-createdAt`           |
| Multiple      | comma-separated      | `?sort=-createdAt,amount`    |

**Demo:**  
`GET https://api.example.com/v1/orders?sort=-createdAt,amount`

---

## 4. Pagination

| Param   | Meaning     | Example |
|---------|-------------|---------|
| `page`  | Page number | `page=1` |
| `limit` | Items per page | `limit=20` |

**Demo:**  
`GET https://api.example.com/v1/orders?page=2&limit=20`

---

## 5. Limit returned fields

Return only specific columns.

| Param    | Meaning              | Example (fields: `id`, `name`, `status`) |
|----------|----------------------|------------------------------------------|
| `fields=id,name,status` | only these fields | `?fields=id,name,status` |

**Demo:**  
`GET https://api.example.com/v1/orders?fields=id,name,status,amount`

---

## 6. Search

Full-text style search across configured fields (backend defines which fields).

| Param    | Meaning   | Example   |
|----------|-----------|-----------|
| `search=term` | search term | `?search=coffee` |

**Demo:**  
`GET https://api.example.com/v1/orders?search=coffee`

---

## 7. Combined example

Filter (status not 6, amount ≥ 10), sort by newest, page 1, 10 per page, only some fields:

```
GET https://api.example.com/v1/orders?statusId[ne]=6&amount[gte]=10&sort=-createdAt&page=1&limit=10&fields=id,name,status,amount,createdAt
```

---

**Note:** Replace `orders` and field names (`statusId`, `amount`, `name`, etc.) with your actual endpoint and column names. Booleans: use `true` / `false`; for "null" use the string `null`.
