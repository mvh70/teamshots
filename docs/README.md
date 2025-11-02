# Teamshots Documentation

## 📋 **Documentation Overview**

This documentation provides a complete guide to the Teamshots AI Team Photo Generator project. All documentation follows the principle of **single source of truth** - each topic is documented in one place with cross-references to avoid duplication.

## 📚 **Document Structure**

### **Core Documentation**
- **[PRD](teamshots_prd.md)** - Product Requirements Document (overview, goals, scope)
- **[Features](features.md)** - Detailed feature specifications and functionality
- **[User Flows](user_flows)** - Complete user journey and interaction flows
- **[Business Model](business_model)** - Pricing, revenue model, and business strategy

### **Technical Documentation**
- **[Getting Started](getting_started_updated.md)** - Complete setup and development guide
- **[Infrastructure](infra.md)** - Architecture, tech stack, and deployment
- **[Credit System](CREDIT_SYSTEM.md)** - Transaction-based credit management architecture
- **[Team Management](TEAM_MANAGEMENT.md)** - Team invitation and management system
- **[Role System Implementation](ROLE_SYSTEM_IMPLEMENTATION.md)** - Comprehensive role-based permission system
- **[S3 Setup](S3_SETUP.md)** - File storage configuration and setup
- **[DNS Setup](DNS_SETUP.md)** - Domain configuration
- **[Email Setup](EMAIL_SETUP.md)** - Email service configuration
- **[Deployment](DEPLOYMENT.md)** - Production deployment guide

### **Value & Positioning**
- **[Value Proposition](value_proposition.md)** - Market positioning and value delivery

## 🎯 **Key Features (Current Implementation)**

### **✅ Implemented Features**
- **Role-Based Permission System** - Comprehensive access control with 4 user roles (Platform Admin, Team Admin, Team Member, Individual User)
- **Transaction-Based Credit System** - Full audit trail for all credit movements
- **Team Management Dashboard** - Complete team member overview with stats and credit balances
- **Token-Based Team Invites** - 24hr tokens with automatic credit allocation
- **Generation Type Selection** - Personal vs Team use with different credit sources
- **Context Management** - Reusable photo generation settings
- **File Upload System** - S3 storage for uploaded and generated images
- **Internationalization** - English and Spanish support
- **Authentication** - NextAuth.js with email/password and OAuth support


### **🔄 Current User Flow**
1. **Photo Upload** - Drag-drop or file picker with validation
2. **Generation Type Selection** - Choose Personal or Team use
3. **Customization** - Style, background, and logo options
4. **Generation** - AI processing with context application
5. **Review & Approval** - Generated photo review and selection

## 🚀 **Quick Start**

### **For Developers**
1. Read [Getting Started Guide](getting_started_updated.md)
2. Set up [S3 Storage](S3_SETUP.md)
3. Configure [Infrastructure](infra.md)
4. Follow [Deployment Guide](DEPLOYMENT.md)

### **For Product/Design**
1. Review [PRD](teamshots_prd.md) for product overview
2. Study [User Flows](user_flows) for interaction design
3. Check [Features](features.md) for detailed specifications
4. Understand [Business Model](business_model) for pricing strategy

## 🔧 **Technical Stack**

- **Frontend**: Next.js 15+, TypeScript, Tailwind CSS
- **Backend**: Next.js API Routes, Prisma ORM
- **Database**: PostgreSQL
- **Storage**: S3-compatible storage (AWS/Hetzner)
- **AI**: Google Gemini API (direct integration)
- **Auth**: NextAuth.js
- **Payments**: Stripe
- **Deployment**: Hetzner VPS + Coolify
- **i18n**: next-intl (EN/ES)
- **Permissions**: Role-based access control system

## 📖 **Documentation Principles**

### **Single Source of Truth**
- Each topic documented in one place only
- Cross-references used instead of duplication
- Links to authoritative sources for external information

### **Minimalistic & Focused**
- No fluff or redundant information
- Clear, actionable content
- Technical details where needed, high-level overview where appropriate

### **Up-to-Date**
- Documentation reflects current implementation
- Regular updates with code changes
- Version control for documentation changes

## 🔗 **Cross-References**

### **Setup & Configuration**
- S3 setup → [S3_SETUP.md](S3_SETUP.md)
- Domain setup → [DNS_SETUP.md](DNS_SETUP.md)
- Email setup → [EMAIL_SETUP.md](EMAIL_SETUP.md)
- Deployment → [DEPLOYMENT.md](DEPLOYMENT.md)

### **Development**
- Complete setup → [Getting Started](getting_started_updated.md)
- Architecture → [Infrastructure](infra.md)
- Credit system → [Credit System](CREDIT_SYSTEM.md)
- Team management → [Team Management](TEAM_MANAGEMENT.md)
- API endpoints → [Infrastructure](infra.md) (API section)
- Deployment → [Deployment Guide](DEPLOYMENT.md)

### **Product**
- Overview → [PRD](teamshots_prd.md)
- Features → [Features](features.md)
- User experience → [User Flows](user_flows)
- Business strategy → [Business Model](business_model)

## 📝 **Contributing to Documentation**

When updating documentation:
1. **Update the single source** - Don't duplicate information
2. **Add cross-references** - Link to related sections
3. **Keep it minimal** - Remove fluff, keep essentials
4. **Test links** - Ensure all cross-references work
5. **Update this README** - If adding new documents

## 🎯 **Current Status**

**Implementation Status**: Core features implemented and documented
**Documentation Status**: Aligned with current implementation
**Next Steps**: See individual documents for specific next actions

---

*Last Updated: January 2025*
*Version: 1.0*
