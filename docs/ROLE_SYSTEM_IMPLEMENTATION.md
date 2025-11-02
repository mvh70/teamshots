# Role-Based Permission System Implementation

## Overview

The comprehensive role-based permission system has been successfully implemented in Teamshots. This system provides granular access control across the platform, supporting multiple user roles with distinct permissions and capabilities.

## Architecture

### Database Schema Updates

The `User` model in `prisma/schema.prisma` has been updated to support explicit roles:

```prisma
model User {
  id                  String    @id @default(cuid())
  email               String    @unique
  password            String?
  emailVerified       DateTime?
  role                String    @default("user") // 'user' | 'team_admin' | 'team_member'
  isAdmin             Boolean   @default(false)  // Platform admin status
  locale              String    @default("en")
  // ... other fields
}
```

### Role Definitions

#### 1. Platform Admin
- **Database Field**: `isAdmin = true`
- **Permissions**: Full platform access
- **Capabilities**: Manage all companies, users, and platform-wide features
- **Note**: Can be combined with any role (user, team_admin, team_member)

#### 2. Team Admin (`team_admin`)
- **Database Role**: `role = 'team_admin'`
- **Team Admin**: User is the `adminId` of their team
- **Permissions**: Full team management
- **Capabilities**: Invite team members, allocate credits, manage team settings

#### 3. Team Member (`team_member`)
- **Database Role**: `role = 'team_member'`
- **Team Member**: User has a `Person` record linked to a team
- **Permissions**: Team features access
- **Capabilities**: View team dashboard, collaborate with team

#### 4. Individual User (`user`)
- **Database Role**: `role = 'user'`
- **Individual**: User operates independently
- **Permissions**: Personal features only
- **Capabilities**: Personal dashboard, individual generations

### Role Assignment on Signup

When users sign up:
- **From team invite**: Automatically assigned `team_member` role (if they accepted a team invite before signing up)
- **New individual user**: Assigned `user` role by default
- **Team admin**: Assigned `team_admin` role when they create a team and are designated as admin

### Admin Status Assignment

The `isAdmin` field is separate from the role system:
- **Platform admins**: Manually assigned `isAdmin = true` by system administrators
- **Testing flexibility**: Can assign any role + admin status for testing scenarios
- **Permission inheritance**: Admin status overrides role-based restrictions

## Implementation Components

### 1. Role Permission Utilities (`src/lib/roles.ts`)

Core functions for role management:

- `getUserEffectiveRoles()` - Determines user's effective roles
- `hasPermission()` - Checks if user has specific permission
- `requirePermission()` - Throws error if permission denied
- `createPermissionContext()` - Builds permission context

### 2. Permission Middleware (`src/lib/permissions.ts`)

API middleware for enforcing permissions:

- `withPermission()` - General permission checking
- `withTeamPermission()` - Team-specific permissions
- `withAdminPermission()` - Platform admin permissions
- `checkPermission()` - UI-level permission checking
- `getUserRoles()` - Get effective roles for UI display

### 3. Authentication System Updates

Updated `src/lib/auth.ts` and `src/types/next-auth.d.ts` to include role information in sessions:

```typescript
interface Session {
  user: {
    id: string
    email: string
    role: string
    person?: {
      team?: {
        id: string
        name: string
        adminId: string
      }
    }
  }
}
```

### 4. API Endpoint Protection

Protected endpoints with role-based access control:

- `/api/team/members` - Team admin/member access
- `/api/team/invites` - Team admin access for creating invites
- `/api/team/invites/resend` - Team admin access for resending invites
- `/api/team/invites/revoke` - Team admin access for revoking invites
- `/api/team/members/role` - Team admin access for role changes
- `/api/team/members/remove` - Team admin access for removing members
- `/api/styles` - Team member access
- `/api/user/settings` - User's own settings only

### 5. UI Role Indicators

Role indicators throughout the interface:

- **Sidebar**: Clean user profile display with context-aware credits (individual mode shows "Credits", team mode shows "Personal Credits" and "Team Credits")
- **Team Page**: Detailed role information for team members
- **Settings Page**: Current roles display
- **Conditional Rendering**: UI elements shown/hidden based on permissions

## Key Features

### Dual Role Support

Users can be both team members and individual users:

- **Team Mode**: Access to team features and team dashboard
- **Individual Mode**: Personal features and individual dashboard
- **Seamless Switching**: Toggle between modes in settings

### Permission Enforcement

- **API Level**: Middleware enforces permissions on all protected endpoints
- **UI Level**: Components conditionally render based on user permissions
- **Graceful Degradation**: Empty states and clear error messages

### Role-Based UI

- **Navigation**: Sidebar shows/hides items based on user mode
- **Team Management**: Admin-only features for team invitations and member management
- **Admin Controls**: Promote/demote members, remove members, resend/revoke invites
- **Settings**: Mode toggle and role information display

## Testing

### API Testing

All protected endpoints correctly return `401 Unauthorized` when no authentication is provided:

```bash
curl http://localhost:3000/api/team/members
# Returns: {"error": "Unauthorized"}

curl http://localhost:3000/api/team/invites  
# Returns: {"error": "Unauthorized"}

curl http://localhost:3000/api/user/settings
# Returns: {"error": "Unauthorized"}
```

### Build Verification

The system builds successfully with no TypeScript errors:

```bash
npm run build
# ✓ Compiled successfully
```

## Usage Examples

### Checking Permissions in Components

```typescript
import { checkPermission } from '@/domain/access/permissions'

// Check if user can invite team members
const canInvite = await checkPermission(session, 'team.invite_members')

if (canInvite) {
  // Show invite button
}
```

### API Route Protection

```typescript
import { withTeamPermission } from '@/domain/access/permissions'

export async function POST(request: NextRequest) {
  const permissionCheck = await withTeamPermission(
    request,
    'team.invite_members'
  )
  
  if (permissionCheck instanceof NextResponse) {
    return permissionCheck // Return error response
  }
  
  // Continue with protected logic
}

// Example: Member management endpoint
export async function POST(request: NextRequest) {
  const permissionCheck = await withTeamPermission(
    request,
    'team.manage_members'
  )
  
  if (permissionCheck instanceof NextResponse) {
    return permissionCheck // Return error response
  }
  
  // Admin-only member management logic
}
```

### Role Display in UI

```typescript
// Role indicators in team management and settings pages
{session?.user?.role === 'admin' && (
  <span className="badge bg-red-100 text-red-800">
    Platform Admin
  </span>
)}

{session?.user?.person?.team?.adminId === session?.user?.id && (
  <span className="badge bg-purple-100 text-purple-800">
    Team Admin
  </span>
)}

// Context-aware credits display in sidebar
{userMode === 'individual' ? (
  <span>Credits: {credits.individual}</span>
) : (
  <>
    <span>Personal Credits: {credits.individual}</span>
    <span>Team Credits: {credits.team}</span>
  </>
)}
```

