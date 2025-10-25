# Credit System Architecture

## Overview

Teamshots uses a transaction-based credit system that provides full audit trails and flexible credit management for both individual users and company teams.

## Architecture

### CreditTransaction Model

All credit movements are tracked in the `CreditTransaction` table:

```prisma
model CreditTransaction {
  id          String    @id @default(cuid())
  
  // Who this affects (one of these should be set)
  companyId   String?
  company     Company?  @relation(fields: [companyId], references: [id], onDelete: Cascade)
  personId    String?
  person      Person?   @relation(fields: [personId], references: [id], onDelete: Cascade)
  userId      String?
  user        User?     @relation(fields: [userId], references: [id], onDelete: Cascade)
  
  // Transaction details
  amount      Int       // Positive = credit, Negative = debit
  type        String    // 'purchase' | 'transfer_in' | 'transfer_out' | 'generation' | 'refund' | 'invite_allocated'
  description String?   // Human readable description
  
  // References for transfers
  relatedTransactionId String? // Link transfer_in to transfer_out
  relatedTransaction   CreditTransaction? @relation("TransferPair", fields: [relatedTransactionId], references: [id])
  reverseTransactions  CreditTransaction[] @relation("TransferPair")
  
  // Reference to what caused this transaction
  teamInviteId String?
  teamInvite   TeamInvite? @relation(fields: [teamInviteId], references: [id])
  
  createdAt   DateTime  @default(now())
  
  @@index([companyId])
  @@index([personId])
  @@index([userId])
  @@index([type])
  @@index([createdAt])
}
```

## Credit Management Library

The `src/lib/credits.ts` file provides utility functions for managing credits:

### Core Functions

```typescript
// Create a credit transaction
createCreditTransaction(params: CreateCreditTransactionParams)

// Get current credit balance for a company
getCompanyCreditBalance(companyId: string): Promise<number>

// Get current credit balance for a person
getPersonCreditBalance(personId: string): Promise<number>

// Get current credit balance for a user
getUserCreditBalance(userId: string): Promise<number>

// Transfer credits from company to person
transferCreditsFromCompanyToPerson(
  companyId: string, 
  personId: string, 
  amount: number, 
  description?: string
)

// Allocate credits to a person from an invite
allocateCreditsFromInvite(
  personId: string,
  teamInviteId: string,
  amount: number,
  description?: string
)

// Use credits for generation
useCreditsForGeneration(
  personId: string | null,
  userId: string | null,
  amount: number,
  description?: string
)
```

## Credit Flow Examples

### 1. Team Invite Credit Allocation

When a team member accepts an invite:

```typescript
// 1. Person accepts invite
const person = await prisma.person.create({
  data: {
    firstName,
    lastName: lastName || null,
    email: invite.email,
    companyId: invite.companyId,
    inviteToken: token
  }
})

// 2. Allocate credits via transaction
await allocateCreditsFromInvite(
  person.id,
  invite.id,
  invite.creditsAllocated,
  `Credits allocated from team invite to ${invite.email}`
)
```

This creates a `CreditTransaction` with:
- `amount: 5` (positive = credit)
- `type: 'invite_allocated'`
- `personId: person.id`
- `teamInviteId: invite.id`

### 2. Credit Transfer from Company to Person

```typescript
await transferCreditsFromCompanyToPerson(
  companyId,
  personId,
  10,
  "Monthly credit allocation"
)
```

This creates two linked transactions:
1. **Debit**: `amount: -10, type: 'transfer_out', companyId`
2. **Credit**: `amount: +10, type: 'transfer_in', personId`

### 3. Using Credits for Generation

```typescript
await useCreditsForGeneration(
  personId, // or null
  userId,   // or null
  4,
  "Photo generation with corporate context"
)
```

This creates a `CreditTransaction` with:
- `amount: -4` (negative = debit)
- `type: 'generation'`
- `personId` or `userId` (depending on who's generating)

## Credit Balance Calculation

Credit balances are calculated in real-time from transaction history:

```typescript
export async function getPersonCreditBalance(personId: string): Promise<number> {
  const result = await prisma.creditTransaction.aggregate({
    where: { personId },
    _sum: { amount: true }
  })
  return result._sum.amount || 0
}
```

## Transaction Types

- **`purchase`**: Credits purchased via subscription or top-up
- **`transfer_in`**: Credits received from company transfer
- **`transfer_out`**: Credits sent to team member
- **`generation`**: Credits used for photo generation
- **`refund`**: Credits refunded for failed generations
- **`invite_allocated`**: Credits allocated when accepting team invite

## Benefits

### 1. Full Audit Trail
Every credit movement is recorded with timestamps, descriptions, and references to related entities.

### 2. Data Integrity
No more scattered credit fields across different models. All credit data is centralized.

### 3. Flexible Transfers
Easy company-to-person credit transfers with proper transaction linking.

### 4. Real-time Balances
Credit balances are always accurate and calculated from transaction history.

### 5. Analytics Ready
Easy to build reports on credit usage, team spending, and generation patterns.

### 6. Debugging Friendly
Clear transaction history makes it easy to trace credit issues.

## Migration from Legacy System

The legacy `credits` field on the `User` model is deprecated but maintained for backward compatibility. New implementations should use the transaction-based system.

## Team Management Integration

The credit system integrates seamlessly with team management:

- **Team Invites**: Automatically allocate credits when invites are accepted
- **Team Dashboard**: Display real-time credit balances for all team members
- **Admin Controls**: Transfer credits between company pool and team members
- **Generation Tracking**: Track which team members use credits for generations
