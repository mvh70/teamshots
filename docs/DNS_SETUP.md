# DNS Configuration for TeamShots

## Your Hetzner VPS IP
**94.130.225.35**

## DNS Records to Add

Go to your domain registrar (where you purchased teamshots.vip) and add the following A records:

### 1. Root Domain (teamshots.vip)
```
Type: A
Name: @ (or leave blank for root)
Value: 94.130.225.35
TTL: 3600 (or Auto)
```

### 2. WWW Subdomain (www.teamshots.vip)
```
Type: A
Name: www
Value: 94.130.225.35
TTL: 3600 (or Auto)
```

### 3. App Subdomain (app.teamshots.vip)
```
Type: A
Name: app
Value: 94.130.225.35
TTL: 3600 (or Auto)
```

## Verification

After adding the DNS records, wait 5-15 minutes for propagation, then verify:

```bash
# Check root domain
dig teamshots.vip +short

# Check www subdomain
dig www.teamshots.vip +short

# Check app subdomain
dig app.teamshots.vip +short
```

All three should return: **94.130.225.35**

## SSL Certificates (via Coolify)

Once DNS is configured, Coolify will automatically provision SSL certificates via Let's Encrypt.

## Testing Locally

To test the multi-domain routing locally before DNS is configured:

1. Add to `/etc/hosts`:
```
127.0.0.1 teamshots.vip
127.0.0.1 www.teamshots.vip
127.0.0.1 app.teamshots.vip
```

2. Run the dev server:
```bash
npm run dev
```

3. Visit:
- http://www.teamshots.vip:3000 (Marketing site)
- http://app.teamshots.vip:3000 (App site)

## Next Steps

After DNS is configured:
1. Deploy to Hetzner VPS via Coolify
2. Configure SSL in Coolify dashboard
3. Test both domains
4. Update any hardcoded URLs in the app

