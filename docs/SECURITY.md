# Security Documentation

## Overview

This document outlines the security measures implemented in the Teamshots application to protect against common vulnerabilities and ensure data privacy.

## Security Features

### 1. Authentication & Authorization

- **Multi-factor Authentication**: OTP verification required for registration
- **Password Security**: Minimum 6 characters with complexity requirements
- **Session Management**: 15-minute access tokens with refresh token rotation
- **Role-Based Access Control**: Granular permissions for different user types
- **CSRF Protection**: NextAuth built-in CSRF protection with secure cookies
- **Authorization Checks**: Comprehensive authorization for all data access
- **Company Data Isolation**: Company members can only access company data

### 2. File Upload Security

- **Content Validation**: File type verification by content, not extension
- **Size Limits**: Maximum 5MB file size
- **Private Storage**: All files stored privately in S3 with signed URL access
- **Indirect Object References**: Sequential numbering instead of direct database IDs
- **Public/Private Toggle**: User-controlled image visibility

### 3. API Security

- **Rate Limiting**: Protection against brute force and DoS attacks
  - Generation endpoints: 10 requests per 5 minutes
  - Upload endpoints: 10 requests per 5 minutes
  - OTP endpoints: 3 requests per 5 minutes
  - General API: 100 requests per minute
- **Input Validation**: Comprehensive validation using Zod schemas
- **SQL Injection Prevention**: Prisma ORM with parameterized queries
- **CORS Configuration**: Restricted to allowed origins only
- **Command Injection Prevention**: Input validation for external script execution

### 4. Security Headers

- **Content Security Policy**: Prevents XSS attacks (removed unsafe-eval)
- **X-Frame-Options**: Prevents clickjacking
- **X-Content-Type-Options**: Prevents MIME sniffing
- **Strict-Transport-Security**: Enforces HTTPS
- **Permissions Policy**: Restricts browser features
- **X-DNS-Prefetch-Control**: Prevents DNS prefetching
- **X-Download-Options**: Prevents file execution
- **X-Permitted-Cross-Domain-Policies**: Restricts cross-domain policies

### 5. Data Protection

- **Row-Level Security**: Application-level data isolation with PostgreSQL RLS planned
- **Encrypted Storage**: Sensitive data encrypted at rest
- **Secure Sessions**: JWT tokens with short expiration
- **Audit Logging**: Comprehensive security event logging
- **Cryptographically Secure Random**: OTP generation uses crypto.randomBytes()
- **Information Disclosure Prevention**: Debug logs and sensitive data removed

## Recent Security Improvements

### Critical Fixes Implemented
- **OTP Security**: Replaced Math.random() with crypto.randomBytes() for cryptographically secure OTP generation
- **Command Injection Prevention**: Added input validation for base64 data before passing to Python scripts
- **Authorization Enhancement**: Added comprehensive authorization checks for file access and generation endpoints
- **Debug Code Removal**: Removed all debug console.log statements and debug file saving from production code
- **CSRF Protection**: Configured NextAuth with secure cookies and CSRF protection
- **Rate Limiting**: Added rate limiting for generation endpoints (10 per 5 minutes)
- **Security Headers**: Enhanced security headers including CSP improvements and additional protection headers
- **Input Validation**: Enhanced input validation with additional Zod schemas for security

### Documentation Created
- **RLS Implementation Strategy**: Comprehensive plan for PostgreSQL Row-Level Security implementation
- **Security Testing Checklist**: Detailed checklist for security testing and validation
- **Updated Security Documentation**: Enhanced security documentation with latest improvements

## Security Monitoring

### Logged Events

- Authentication attempts (success/failure)
- Permission denials
- Rate limit violations
- Suspicious activity patterns
- File access attempts

### Monitoring Dashboard

Security logs are stored in the `SecurityLog` table and can be queried for:
- Failed login attempts by IP
- Permission escalation attempts
- Unusual access patterns
- Rate limit violations

## Incident Response

### Security Incident Procedure

1. **Detection**: Monitor security logs for anomalies
2. **Assessment**: Determine severity and scope
3. **Containment**: Implement immediate protective measures
4. **Investigation**: Analyze logs and system state
5. **Recovery**: Restore normal operations
6. **Lessons Learned**: Update security measures

### Emergency Contacts

- **Security Team**: security@teamshots.vip
- **Development Team**: dev@teamshots.vip
- **Infrastructure**: ops@teamshots.vip

## Security Best Practices

### For Developers

1. **Never log sensitive data** (passwords, tokens, personal information)
2. **Validate all inputs** using the provided validation schemas
3. **Use the permission system** for all API endpoints
4. **Follow the principle of least privilege**
5. **Regular security updates** for dependencies

### For Users

1. **Use strong passwords** (12+ characters with complexity)
2. **Enable 2FA** when available
3. **Keep software updated**
4. **Report suspicious activity** immediately
5. **Use secure networks** for sensitive operations

## Compliance

### Data Protection

- **GDPR Compliance**: User data protection and right to deletion
- **Data Minimization**: Only collect necessary information
- **Consent Management**: Clear opt-in for data processing
- **Data Retention**: Automatic cleanup of expired data

### Security Standards

- **OWASP Top 10**: Protection against common vulnerabilities
- **ISO 27001**: Information security management
- **SOC 2**: Security, availability, and confidentiality

## Security Updates

Regular security updates are applied to:
- Dependencies and libraries
- Security configurations
- Monitoring systems
- Incident response procedures

## Contact

For security concerns or to report vulnerabilities:
- **Email**: security@teamshots.vip
- **PGP Key**: Available upon request
- **Response Time**: 24 hours for critical issues

---

*Last Updated: January 2025*
*Version: 1.0*
