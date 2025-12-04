# Lead Management API Documentation

**Base URL**: `{{URL}}/api/v1/leads`
**Authentication**: Bearer Token required for all endpoints.

## 1. Get All Leads
**Endpoint**: `GET /`
**Description**: Retrieve a paginated list of leads with optional filtering and search.
**Query Parameters**:
- `page`: Page number (default: 1)
- `limit`: Items per page (default: 10)
- `status`: Filter by status (e.g., 'New Enquiry')
- `search`: Search by company, contact name, or email.
- `sort`: Sort field (e.g., '-createdAt' for descending).

**Response**:
```json
{
  "success": true,
  "data": {
    "leads": [
      {
        "id": 1,
        "company": "Tech Corp",
        "contactName": "John Doe",
        "status": "New Enquiry",
        "createdAt": "2023-10-27T10:00:00.000Z"
        // ... other fields
      }
    ],
    "pagination": {
      "total": 50,
      "totalPages": 5,
      "currentPage": 1,
      "limit": 10
    }
  },
  "message": "Leads retrieved successfully"
}
```

## 2. Create Lead
**Endpoint**: `POST /`
**Description**: Create a new lead.
**Body**:
```json
{
  "company": "Tech Corp",
  "contactName": "John Doe",
  "contactEmail": "john@techcorp.com",
  "contactPhone": "1234567890",
  "leadSource": "Website",
  "status": "New Enquiry",
  "tag": "Hot Lead"
}
```
**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "company": "Tech Corp",
    // ... created lead object
  },
  "message": "Lead created successfully"
}
```

## 3. Get Kanban Leads
**Endpoint**: `GET /kanban`
**Description**: Get leads grouped by status for Kanban board display.
**Response**:
```json
{
  "success": true,
  "data": {
    "newEnquiry": [ ... ],
    "contacted": [ ... ],
    "quoted": [ ... ],
    "demoScheduled": [ ... ],
    "negotiation": [ ... ],
    "nurture": [ ... ],
    "won": [ ... ],
    "lost": [ ... ]
  },
  "message": "Kanban leads retrieved successfully"
}
```

## 4. Get Lead Stats
**Endpoint**: `GET /stats`
**Description**: Get overview statistics.
**Response**:
```json
{
  "success": true,
  "data": {
    "totalLeads": 100,
    "leadsByStatus": [
      { "status": "New Enquiry", "count": 10 },
      { "status": "WON", "count": 5 }
    ],
    "conversionRate": "5.00"
  },
  "message": "Lead statistics retrieved successfully"
}
```

## 5. Get Lead Details
**Endpoint**: `GET /:id`
**Description**: Get full details of a specific lead, including activity logs.
**Response**:
```json
{
  "success": true,
  "data": {
    "id": 1,
    "company": "Tech Corp",
    "LeadLogs": [
      {
        "id": 1,
        "type": "status",
        "message": "Lead created",
        "createdAt": "..."
      }
    ]
    // ... lead details
  },
  "message": "Lead retrieved successfully"
}
```

## 6. Update Lead
**Endpoint**: `PATCH /:id`
**Description**: Update general lead information.
**Body**:
```json
{
  "status": "Contacted",
  "tag": "Warm Lead"
}
```
**Response**:
```json
{
  "success": true,
  "data": { ...updated lead... },
  "message": "Lead updated successfully"
}
```

## 7. Delete Lead
**Endpoint**: `DELETE /:id`
**Description**: Permanently delete a lead.
**Response**:
```json
{
  "success": true,
  "data": null,
  "message": "Lead deleted successfully"
}
```

## 8. Schedule Follow-up
**Endpoint**: `POST /:id/follow-up`
**Description**: Set a follow-up date and add a note.
**Body**:
```json
{
  "date": "2023-12-25T10:00:00.000Z",
  "notes": "Call regarding proposal"
}
```
**Response**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Follow-up scheduled successfully"
}
```

## 9. Send Quotation
**Endpoint**: `POST /:id/quotation`
**Description**: Record that a quotation was sent. Updates status to 'Quoted'.
**Body**:
```json
{
  "amount": "5000",
  "date": "2023-12-01"
}
```
**Response**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Quotation sent successfully"
}
```

## 10. Schedule Site Visit
**Endpoint**: `POST /:id/site-visit`
**Description**: Schedule a site visit.
**Body**:
```json
{
  "date": "2023-12-10T14:00:00.000Z",
  "notes": "Check machine placement"
}
```
**Response**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Site visit scheduled successfully"
}
```

## 11. Mark as WON
**Endpoint**: `PATCH /:id/won`
**Description**: Update status to 'WON' and customer status to 'Interested'.
**Response**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Lead marked as WON"
}
```

## 12. Mark as LOST
**Endpoint**: `PATCH /:id/lost`
**Description**: Update status to 'LOST' with a reason.
**Body**:
```json
{
  "reason": "Price Too High",
  "feedback": "Found cheaper alternative"
}
```
**Response**:
```json
{
  "success": true,
  "data": { ... },
  "message": "Lead marked as LOST"
}
```
