# Team Management System

## Overview

Teamshots provides comprehensive team management capabilities for team admins to manage team photo generation workflows, including team member invitations, credit allocation, and generation oversight.

*See [Role System Implementation](ROLE_SYSTEM_IMPLEMENTATION.md) for detailed role definitions and permissions.*

## Key Features

### 1. Team Context Setup
- **Reusable Templates**: Create branded contexts with custom backgrounds, logos, and style presets
- **Multiple Contexts**: Maintain different contexts for different use cases (executive, casual, etc.)
- **Active Context**: Set default context for new team photo generations

### 2. Team Member Invitations
- **Email-Based Invites**: Send invitation links via email with 24-hour expiration
- **No Signup Required**: Team members can generate photos immediately after accepting invite
- **Credit Allocation**: Specify how many credits to allocate to each team member
- **Automatic Credit Assignment**: Credits are allocated via transaction system when invite is accepted

### 3. Team Dashboard
- **Member Overview**: View all team members with their status and credit balances
- **Real-time Stats**: See selfie count, generation count, and credit balances for each member
- **Admin Controls**: Identify admin users and current user
- **Status Tracking**: Distinguish between registered users and guest team members

### 4. Credit Management
- **Transaction-Based System**: All credit movements tracked in `CreditTransaction` table
- **Real-time Balances**: Credit balances calculated from transaction history
- **Transfer Capabilities**: Transfer credits between team pool and team members
- **Audit Trail**: Full history of all credit allocations and usage

## Database Schema

### Core Models

```prisma
// Person - Individual team member (can exist without User account)
model Person {
  id                  String    @id @default(cuid())
  firstName           String
  lastName            String?
  email               String?
  
  // Optional User link (if person signs up)
  userId              String?   @unique
  user                User?     @relation(fields: [userId], Team: Team[]
  
  // Team relationship
  teamId           String?
  team             Team?  @relation(fields: [teamId], references: [id])
  
  // Generation tracking
  generations         Generation[]
  selfies             Selfie[]
  
  // Invite tracking
  inviteToken         String?   @unique
  invitedAt           DateTime?
  inviteAcceptedAt    DateTime?
  
  // Credit transactions
  creditTransactions  CreditTransaction[]
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

// Team - Organization managing team photos
model Team {
  id                  String    @id @default(cuid())
  name                String
  website             String?
  domain              String?
  
  // Admin relationship
  adminId             String
  admin               User      @relation("TeamAdmin", fields: [adminId])
  
  // Team members
  teamMembers         Person[]
  
  // Context management
  contexts            Context[]
  activeContextId     String?   @unique
  activeContext       Context?  @relation("ActiveContext")
  
  // Team invites
  teamInvites         TeamInvite[]
  
  // Credit transactions
  creditTransactions  CreditTransaction[]
  
  createdAt           DateTime  @default(now())
  updatedAt           DateTime  @updatedAt
}

// TeamInvite - Token-based invitations
model TeamInvite {
  id              String    @id @default(cuid())
  email           String
  teamId       String
  team         Team   @relation(fields: [teamId])
  token           String    @unique
  expiresAt       DateTime
  usedAt          DateTime?
  creditsAllocated Int      @default(5)
  
  // User conversion tracking
  convertedUserId String?   @unique
  convertedUser   User?     @relation(fields: [convertedUserId])
  
  // Credit transactions
  creditTransactions CreditTransaction[]
  
  createdAt       DateTime  @default(now())
  updatedAt       DateTime  @updatedAt
}
```

## API Endpoints

### Team Management

#### Get Team Members
```
GET /api/team/members
```
Returns list of team members with their stats and credit balances.

#### Create Team Invite
```
POST /api/team/invites
Body: { email: string, creditsAllocated: number }
```
Creates team invitation and sends email.

#### Validate Team Invite
```
POST /api/team/invites/validate
Body: { token: string }
```
Validates invite token and returns invite details.

#### Accept Team Invite
```
POST /api/team/invites/accept
Body: { token: string, firstName: string, lastName?: string }
```
Accepts invite, creates Person record, and allocates credits.

#### Resend Team Invite
```
POST /api/team/invites/resend
Body: { id: string }
```
Resends invitation email for pending invites (admin only).

#### Revoke Team Invite
```
POST /api/team/invites/revoke
Body: { id: string }
```
Cancels/revokes a pending team invitation (admin only).

#### Change Member Role
```
POST /api/team/members/role
Body: { personId: string, role: 'team_member' | 'team_admin' }
```
Promotes or demotes team members (admin only).

#### Remove Team Member
```
POST /api/team/members/remove
Body: { personId: string }
```
Removes a team member from the team (admin only).

## User Interface

### Team Dashboard (`/app-routes/team`)

The team management dashboard provides:

1. **Active Context Status**: Shows current active context or setup prompt
2. **Team Members List**: 
   - Avatar with initials
   - Name and email
   - Admin badge for administrators
   - "You" indicator for current user
   - Real-time stats (selfies, generations, credits)
   - Status (Registered vs Guest)
3. **Team Invites Section**:
   - List of pending, accepted, and expired invites
   - Invite creation form
   - Credit allocation settings
   - Admin controls: resend and revoke buttons for pending invites

4. **Admin Controls** (Team Admin Only):
   - Promote/demote team members
   - Remove team members from team
   - Resend expired invitations
   - Revoke pending invitations
   - Safety checks prevent removing sole admin

### Team Member Status

- **Registered**: User has signed up and has User account
- **Guest**: Person record only, no User account yet
- **Admin**: Team administrator with full permissions

## Credit Allocation Flow

### 1. Invite Creation
```typescript
// Admin creates invite with credit allocation
const invite = await prisma.teamInvite.create({
  data: {
    email: "team@team.com",
    teamId: team.id,
    token: generateToken(),
    expiresAt: addHours(new Date(), 24),
    creditsAllocated: 5
  }
})
```

### 2. Invite Acceptance
```typescript
// Person accepts invite
const person = await prisma.person.create({
  data: {
    firstName,
    lastName,
    email: invite.email,
    teamId: invite.teamId,
    inviteToken: token
  }
})

// Allocate credits via transaction
await allocateCreditsFromInvite(
  person.id,
  invite.id,
  invite.creditsAllocated
)
```

### 3. Credit Usage
```typescript
// When person generates photos
await useCreditsForGeneration(
  personId,
  null, // No userId if guest
  4,
  "Photo generation"
)
```

## Internationalization

The team management system supports:

- **Multi-language UI**: English and Spanish interfaces
- **Localized Emails**: Invitation emails sent in user's preferred language
- **Currency Formatting**: Proper currency display based on locale
- **Date/Time Formatting**: Localized date and time displays

## Security Considerations

### Access Control
- Only team admins can manage team members
- Team invites are token-based with 24-hour expiration
- Credit transfers require admin privileges

### Data Privacy
- Team members can generate photos without creating accounts
- Original selfies are retained only if photos are approved
- Generated photos are deleted if rejected by user

### Audit Trail
- All credit movements are tracked in transaction table
- Team invite acceptance is logged with timestamps
- Generation history maintains full audit trail

## Future Enhancements

### Planned Features
- **Bulk Operations**: Invite multiple team members at once
- **Role Management**: Different permission levels for team members
- **Usage Analytics**: Detailed reports on team photo generation patterns
- **Integration APIs**: Connect with HR systems for automatic team management
- **Advanced Credit Controls**: Set spending limits and approval workflows

### Scalability Considerations
- **Database Indexing**: Optimized queries for large teams
- **Caching**: Team member stats cached for performance
- **Pagination**: Large team lists paginated for better UX
