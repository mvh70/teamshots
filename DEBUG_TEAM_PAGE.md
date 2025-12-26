# Debug: Team Page Not Showing Seats

All code changes are complete and correct. If you still see "Available Photos", try these steps:

## 1. Hard Refresh (Most Important!)

**Mac:**
- Press `Cmd + Shift + R`
- OR open DevTools (Cmd + Option + I) → Right-click refresh → "Empty Cache and Hard Reload"

**Windows/Linux:**
- Press `Ctrl + Shift + R` 
- OR `Ctrl + F5`

## 2. Check Browser Console

Open DevTools Console (F12) and run:
```javascript
// Check API response
fetch('/api/team/members')
  .then(r => r.json())
  .then(data => {
    console.log('Seat Info:', data.seatInfo);
    console.log('Is Seats Model:', data.seatInfo?.isSeatsModel);
  });
```

**Expected for Seats-Based Team:**
```javascript
{
  seatInfo: {
    totalSeats: 10,
    activeSeats: 1,
    availableSeats: 9,
    isSeatsModel: true  // ← This MUST be true
  }
}
```

## 3. Verify Database

Check your database values:
```sql
-- Check User
SELECT id, email, signupDomain FROM "User" WHERE email = 'your-email@example.com';
-- signupDomain should be: teamshotspro.com

-- Check Team
SELECT id, name, isLegacyCredits, totalSeats, activeSeats 
FROM "Team" 
WHERE adminId = 'your-user-id';
-- Expected:
-- isLegacyCredits: false
-- totalSeats: 10 (or whatever you set)
-- activeSeats: 1
```

## 4. Restart Dev Server (If Nothing Works)

```bash
# Kill the dev server
# Terminal 78: Ctrl+C

# Restart
npm run dev
```

## 5. Check Network Tab

1. Open DevTools → Network tab
2. Refresh the page
3. Find the `/api/team/members` request
4. Check the response - look for `seatInfo` object

## What You Should See After Fix:

### Top Stats (3 cards → 2 cards):
✅ Card 1: "Seat usage: 1 of 10"
✅ Card 2: "Photos generated: X"
❌ "Available photos" card is GONE

### Team Members Table:
✅ Desktop: 3 columns (Member, Selfies, Generations, Status)
✅ Mobile: 2 stat cards (Selfies, Generations)
❌ No "Available Photos" column/card

---

**Still not working?** The most likely cause is browser cache. Try:
1. Open incognito/private window
2. Navigate to http://localhost:3000/app/team
3. Should work immediately in fresh browser state

