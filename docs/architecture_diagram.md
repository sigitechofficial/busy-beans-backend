# Busy Beans Backend - Architecture Diagrams

## System Architecture

```mermaid
graph TB
    subgraph "Client Layer"
        A1[Admin Dashboard]
        A2[Sales Rep Portal]
        A3[Customer Portal]
        A4[Supplier Portal]
        A5[Mobile Apps]
    end
    
    subgraph "API Layer - Express.js"
        B1[Admin Routes]
        B2[User Routes]
        B3[Lead Routes]
        B4[QBO Routes]
        B5[Webhook Routes]
    end
    
    subgraph "Middleware Layer"
        C1[JWT Auth]
        C2[Role Check]
        C3[Rate Limiter]
        C4[Error Handler]
    end
    
    subgraph "Controller Layer"
        D1[Lead Controller]
        D2[Order Controller]
        D3[Customer Controller]
        D4[Sales Rep Controller]
        D5[Product Controller]
    end
    
    subgraph "Service Layer"
        E1[Order Service]
        E2[QBO Service]
        E3[Payment Service]
        E4[Email Service]
    end
    
    subgraph "Data Layer"
        F1[(MySQL Database)]
        F2[(Redis Cache)]
    end
    
    subgraph "External Services"
        G1[Stripe API]
        G2[QuickBooks Online]
        G3[Email SMTP]
        G4[Firebase FCM]
    end
    
    A1 & A2 & A3 & A4 & A5 --> B1 & B2 & B3 & B4 & B5
    B1 & B2 & B3 & B4 & B5 --> C1
    C1 --> C2 --> C3 --> C4
    C4 --> D1 & D2 & D3 & D4 & D5
    D1 & D2 & D3 & D4 & D5 --> E1 & E2 & E3 & E4
    E1 & E2 & E3 & E4 --> F1 & F2
    E2 --> G2
    E3 --> G1
    E4 --> G3
    D1 & D2 --> G4
```

## Database Entity Relationships

```mermaid
erDiagram
    user ||--o{ order : places
    user ||--o{ address : has
    user ||--o{ orderFrequency : subscribes
    user ||--o{ userDiscount : receives
    user }o--|| salesRep : "managed by"
    
    salesRep ||--o{ order : manages
    salesRep ||--o{ partnerOrder : places
    salesRep ||--o{ employee : employs
    salesRep ||--|| qboToken : "has auth"
    
    order ||--o{ item : contains
    order ||--|| orderFrequency : "scheduled by"
    order ||--o{ orderHistory : tracks
    order }o--|| supplier : "fulfilled by"
    
    product ||--o{ item : "ordered as"
    product ||--o{ userDiscount : "discounted in"
    product ||--o{ skuSupplier : "supplied by"
    
    Lead ||--o{ LeadLog : "has logs"
    Lead }o--|| coffeeMachine : "interested in"
    
    employee ||--o{ employeePermission : has
    permission ||--o{ employeePermission : "granted in"
```

## Lead Management Pipeline

```mermaid
stateDiagram-v2
    [*] --> NewEnquiry: Lead Created
    NewEnquiry --> Contacted: First Contact Made
    Contacted --> Quoted: Quotation Sent
    Quoted --> Demo: Demo/Site Visit Scheduled
    Demo --> Negotiation: In Discussion
    Negotiation --> Nurture: Need More Time
    Nurture --> Contacted: Follow-up
    Negotiation --> WON: Deal Closed
    Quoted --> WON: Quick Win
    Demo --> WON: Immediate Purchase
    
    NewEnquiry --> LOST: Not Interested
    Contacted --> LOST: No Response
    Quoted --> LOST: Price Too High
    Demo --> LOST: Chose Competitor
    Negotiation --> LOST: Budget Issues
    
    WON --> [*]: Convert to Customer
    LOST --> [*]: Archive Lead
```

## Order Processing Flow

```mermaid
sequenceDiagram
    participant C as Customer
    participant API as API Server
    participant DB as Database
    participant S as Stripe
    participant QBO as QuickBooks
    participant E as Email Service
    participant SUP as Supplier
    
    C->>API: Place Order
    API->>DB: Create Order Record
    API->>S: Create Payment Intent
    S-->>API: Payment Confirmed
    API->>DB: Update Payment Status
    API->>E: Send Order Confirmation
    E-->>C: Email Sent
    
    API->>SUP: Assign Order
    SUP->>API: Acknowledge Order
    API->>DB: Update Order Status
    
    SUP->>API: Mark as Dispatched
    API->>E: Send Dispatch Email
    E-->>C: Tracking Info
    
    SUP->>API: Mark as Delivered
    API->>DB: Update Status
    API->>QBO: Sync Invoice
    QBO-->>API: Invoice Created
    API->>E: Send Invoice
    E-->>C: Invoice Email
```

## Multi-Tenant Architecture

```mermaid
graph LR
    subgraph "Admin Realm"
        A1[Admin QBO Account]
        A2[Admin Orders]
        A3[Direct Customers]
    end
    
    subgraph "Sales Rep 1 Realm"
        B1[Sales Rep 1 QBO]
        B2[Partner Orders]
        B3[Assigned Customers]
        B4[Employees]
    end
    
    subgraph "Sales Rep 2 Realm"
        C1[Sales Rep 2 QBO]
        C2[Partner Orders]
        C3[Assigned Customers]
        C4[Employees]
    end
    
    subgraph "Shared Resources"
        D1[Product Catalog]
        D2[Suppliers]
        D3[Shipping Companies]
    end
    
    A1 -.-> D1 & D2 & D3
    B1 -.-> D1 & D2 & D3
    C1 -.-> D1 & D2 & D3
```

## Commission Calculation Flow

```mermaid
flowchart TD
    A[Order Placed] --> B{Order Type?}
    B -->|Customer Order| C[Calculate Sales Rep Commission]
    B -->|Partner Order| D[No Commission]
    
    C --> E[Commission = Order Total × Rate]
    E --> F[Deduct Stripe Fees]
    F --> G[Record in transfersToSalesRep]
    G --> H{Payment Method?}
    
    H -->|Stripe| I[Immediate Transfer]
    H -->|Bank Account| J[Schedule Pullout]
    
    I --> K[Update QBO]
    J --> L[Lambda: Process Pullouts]
    L --> M[Pull from Bank]
    M --> K
    K --> N[Commission Paid]
```

## Authentication & Authorization Flow

```mermaid
sequenceDiagram
    participant U as User
    participant API as API Server
    participant DB as Database
    participant JWT as JWT Service
    
    U->>API: POST /login (email, password)
    API->>DB: Find User by Email
    DB-->>API: User Record
    API->>API: Compare Password (bcrypt)
    
    alt Password Valid
        API->>JWT: Generate Token
        JWT-->>API: JWT Token
        API->>DB: Update Last Login
        API-->>U: 200 OK + Token + User Data
    else Password Invalid
        API-->>U: 401 Unauthorized
    end
    
    Note over U,API: Subsequent Requests
    
    U->>API: GET /protected-route (with JWT)
    API->>JWT: Verify Token
    
    alt Token Valid
        JWT-->>API: Decoded User Data
        API->>API: Check Role Permissions
        alt Has Permission
            API->>DB: Fetch Data
            DB-->>API: Data
            API-->>U: 200 OK + Data
        else No Permission
            API-->>U: 403 Forbidden
        end
    else Token Invalid
        API-->>U: 401 Unauthorized
    end
```

## Email Notification System

```mermaid
graph TD
    A[Event Triggered] --> B{Event Type?}
    
    B -->|Order Created| C1[orderEmailtoCustomer]
    B -->|Order Created| C2[orderEmailtoLocalPatner]
    B -->|Order Dispatched| D[orderDispatch]
    B -->|Order Shipped| E[orderShipped]
    B -->|Invoice Sent| F[sentInvoiceEmail]
    B -->|Payment Received| G[paidInvoiceEmail]
    B -->|User Registered| H[userAccountCreated]
    B -->|Account Approved| I[userAccountApprove]
    B -->|OTP Request| J[otpToUsers]
    B -->|Quotation| K[coffeeMachineQuotation]
    B -->|Employee Invite| L[inviteEmployee]
    
    C1 & C2 & D & E & F & G & H & I & J & K & L --> M[Email Transporter]
    M --> N[SMTP Server]
    N --> O[Recipient]
```

## QuickBooks Sync Process

```mermaid
flowchart TD
    A[Order/Payment Event] --> B{QBO Connected?}
    B -->|No| C[Skip Sync]
    B -->|Yes| D{Customer Synced?}
    
    D -->|No| E[Create QBO Customer]
    D -->|Yes| F[Get QBO Customer ID]
    
    E --> G[Store QBO Customer ID]
    G --> F
    
    F --> H{Sync Type?}
    H -->|Invoice| I[Create QBO Invoice]
    H -->|Payment| J[Record QBO Payment]
    
    I --> K[Store Invoice ID]
    J --> L[Store Payment ID]
    
    K & L --> M[Update qboLastSync]
    M --> N{Success?}
    
    N -->|Yes| O[Set qboSyncStatus = 'synced']
    N -->|No| P[Set qboSyncStatus = 'error']
    P --> Q[Log Error in qboSyncError]
```

---

## Key Design Patterns

### 1. **Factory Pattern**
- `handlerFactory.js` - Generic CRUD operations

### 2. **Middleware Chain**
- Authentication → Authorization → Rate Limiting → Business Logic

### 3. **Event-Driven**
- Order events trigger emails, notifications, QBO sync

### 4. **Repository Pattern**
- Sequelize models abstract database operations

### 5. **Service Layer**
- Business logic separated from controllers

---

## Security Layers

```mermaid
graph TB
    A[Incoming Request] --> B[Helmet - Security Headers]
    B --> C[CORS - Origin Check]
    C --> D[Rate Limiter]
    D --> E[Body Parser - Size Limit]
    E --> F[Mongo Sanitize - NoSQL Injection]
    F --> G[HPP - Parameter Pollution]
    G --> H[JWT Verification]
    H --> I[Role Authorization]
    I --> J[Business Logic]
    J --> K[Response]
```

---

This architecture provides a scalable, secure, and maintainable foundation for the Busy Beans Coffee distribution platform! 🏗️☕
