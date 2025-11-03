# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

This is 白垩纪食品溯源系统 (Cretas Food Traceability System), focusing on **React Native mobile app** and **backend API** development:

1. **Backend API** (Node.js + Express + MySQL/PostgreSQL + Prisma)
2. **React Native Mobile App** (Expo + TypeScript + React Navigation + DeepSeek LLM)
3. **Spring Boot Backend** (Java 17 + Spring Boot 2.7.15 - cretas-backend-system)

## 🔧 Server Management & Deployment

### 宝塔面板API管理

本项目使用**宝塔面板API**进行服务器管理和应用部署。

**重要配置**:
- **宝塔面板地址**: `https://106.14.165.234:8888` (必须使用HTTPS)
- **API密钥**: 见 `.claude/bt-api-guide.md`
- **应用服务器**: 47.251.121.76:10010

**详细使用指南**: 参见 [`.claude/bt-api-guide.md`](./.claude/bt-api-guide.md)

**快速参考**:
```bash
# 1. 生成API签名
python3 << 'EOF'
import hashlib, time
api_sk = "YOUR_API_KEY"
request_time = str(int(time.time()))
md5_api_sk = hashlib.md5(api_sk.encode()).hexdigest()
request_token = hashlib.md5((request_time + md5_api_sk).encode()).hexdigest()
print(f"{request_time}|{request_token}")
EOF

# 2. 调用API (必须使用 -k 参数和 HTTPS)
curl -k -X POST "https://106.14.165.234:8888/system?action=GetSystemTotal" \
  -d "request_time=$REQUEST_TIME" \
  -d "request_token=$REQUEST_TOKEN"
```

### Spring Boot 后端部署

**部署位置**:
- JAR文件: `/www/wwwroot/cretas/cretas-backend-system-1.0.0.jar`
- 日志文件: `/www/wwwroot/cretas/cretas-backend.log`
- 端口: 10010

**部署步骤**:
1. 编译JAR: `mvn clean package -DskipTests`
2. 上传到服务器: `/www/wwwroot/cretas/`
3. 执行重启脚本: `bash /www/wwwroot/cretas/restart.sh`

**重启脚本** (`/www/wwwroot/cretas/restart.sh`):
```bash
#!/bin/bash
cd /www/wwwroot/cretas
ps aux | grep cretas-backend-system | grep -v grep | awk '{print $2}' | xargs -r kill -9
sleep 2
nohup java -jar cretas-backend-system-1.0.0.jar --server.port=10010 > cretas-backend.log 2>&1 &
echo "Started with PID: $!"
```

## 🎯 Development Strategy (IMPORTANT)

### Frontend-Backend Separation Development Approach

**CRITICAL**: This project follows a **two-phase development strategy** during Phase 1-3:

#### Phase 1-3: React Native Frontend Only
- **Focus**: Develop ONLY React Native frontend application
- **No Backend Implementation**: Do NOT create/modify any backend logic, functions, or database schema
- **API Interface Design**: Create complete API client interfaces in React Native
- **No Mock APIs**: All development is based on real API interface design
- **Requirement Collection**: Record ALL backend requirements in `/mnt/c/Users/Steve/cretas/backend/rn-update-tableandlogic.md`

#### Post-Phase 3: Backend Implementation
- **Backend Development**: Implement all collected backend requirements
- **Final Integration**: Connect frontend with implemented backend APIs

### Why This Strategy?
- ✅ **Parallel Development**: Frontend team can develop independently
- ✅ **Requirement Clarity**: All backend needs are centrally documented
- ✅ **Reduced Dependencies**: No blocking between frontend and backend teams
- ✅ **Efficient Integration**: Clear requirements lead to faster final integration

---

## 🎯 Current Development Phase: Phase 3 功能完善

**Status**: Phase 1-2 已完成 ✅ | Phase 3 开发中 🔨 | Phase 4-5 计划中 📅

**Current Strategy**: **优先完善已有功能，再添加新功能**

### Phase 3 Development Priority

#### P0 (紧急修复 - 2小时)
- 设备监控集成到导航 (EquipmentMonitoringScreen)

#### P1 (核心功能 - 3-4天)
- AI智能分析详情页 (DeepSeekAnalysisScreen)
- 质检完整流程 (CreateQualityRecordScreen, QualityInspectionDetailScreen)
- 成本对比分析、设备告警、库存增强

#### P2 (辅助功能 - 5-7天)
- 用户注册流程 (RegisterPhaseOne/Two)
- 数据报表导出 (DataExportScreen)
- 工厂设置、员工效率、库存盘点、异常预警

**详见**: [`docs/prd/PRD-Phase3-完善计划.md`](./docs/prd/PRD-Phase3-完善计划.md)

### 📱 Already Implemented Pages (24个)

**认证模块**:
- ✅ EnhancedLoginScreen

**主导航**:
- ✅ HomeScreen (首页)
- ✅ ProfileScreen (个人中心)

**考勤模块**:
- ✅ TimeClockScreen (打卡)
- ✅ AttendanceStatisticsScreen (工时统计)

**生产模块** (9个页面):
- ✅ ProcessingDashboard (仪表板)
- ✅ BatchListScreen, BatchDetailScreen, CreateBatchScreen
- ✅ QualityInspectionListScreen
- ✅ CostAnalysisDashboard (成本分析)
- ✅ ProductionPlanManagementScreen (生产计划)
- ✅ MaterialReceiptScreen, MaterialBatchManagementScreen (原材料)

**管理模块** (10个页面):
- ✅ ManagementScreen + ProductType, MaterialType, ConversionRate
- ✅ WorkType, AISettings, User, Whitelist, Supplier, Customer

**平台管理**:
- ✅ AIQuotaManagementScreen

### 🔗 Documentation Reference

**PRD Documents**:
- 📋 [PRD-实现状态总览](./docs/prd/PRD-实现状态总览.md) - 完整的页面实现情况和优先级
- 📚 [PRD-系统产品需求文档-v4.0](./docs/prd/PRD-系统产品需求文档-v4.0.md) - 分阶段的需求文档
- 🛠️ [PRD-Phase3-完善计划](./docs/prd/PRD-Phase3-完善计划.md) - Phase 3的详细开发任务

**Backend Requirements**:
- 🔧 [`backend/rn-update-tableandlogic.md`](./backend/rn-update-tableandlogic.md) - API和数据库需求

---

## Development Commands

### 📱 React Native Development (PRIMARY FOCUS)

**Phase 1-3 Development Commands**:
```bash
cd frontend/CretasFoodTrace
npm install                   # Install dependencies
npm start                     # Start Expo development server (port 3010)
npx expo start               # Alternative start command (port 3010)
npx expo start --clear       # Start with cache cleared (port 3010)
npm run android              # Start on Android (port 3010)
npm run ios                  # Start on iOS (macOS only, port 3010)
npm run web                  # Start web version (port 3010)
```

**⚠️ PORT CONFIGURATION**:
- **React Native Dev Server**: Port `3010` (Expo/Metro bundler)
- **Backend API Server**: Port `3001` (Express API)
- **MySQL Database**: Port `3306` (default)

### 🔧 Backend Services (Supporting Services Only)

**Note**: During Phase 1-3, backend is used only as a supporting service. DO NOT modify backend code.

```bash
cd backend
npm install                    # Install dependencies  
npm run dev                   # Start development server (port 3001)
npm run check                 # Run health checks
npm run studio                # Open Prisma Studio (for database inspection)
```

### 🚀 Quick Start Scripts (Windows)

**Primary Development Script**:
- `start-backend-rn.cmd` - **MAIN**: Start MySQL + Backend (3001) + React Native (3010) (one-click setup)

**Alternative Scripts**:
- `SOLUTION-HUB.cmd` - Development menu with PowerShell issue solutions
- `NO-PROFILE-DEV.cmd` - Bypass PowerShell profile issues completely

### 📋 Backend Requirements Management

**View/Edit Backend Requirements**:
```bash
# Open the backend requirements document
code backend/rn-update-tableandlogic.md

# Or use any text editor
notepad backend/rn-update-tableandlogic.md
```

**IMPORTANT**: All backend logic, API implementations, and database schema changes should be documented in `backend/rn-update-tableandlogic.md`, NOT implemented during Phase 1-3.

## Architecture Overview

### Backend Architecture
- **Framework**: Express.js with ES modules (`"type": "module"`)
- **Database**: MySQL with Prisma ORM (can migrate to PostgreSQL)
- **Authentication**: JWT with refresh tokens, complex multi-role system
- **Mobile Support**: Dedicated `/api/mobile/*` routes for React Native
- **Key Features**: 
  - DeepSeek LLM integration for intelligent analysis
  - File upload with mobile optimization
  - Device binding and activation system
  - Multi-stage registration with phone verification
- **File Structure**:
  - `/src/controllers/` - Request handlers (authController.js, platformController.js)
  - `/src/middleware/` - Authentication, validation, error handling, mobileAuth
  - `/src/routes/` - API routes (auth.js, mobile.js, platform.js, users.js)
  - `/src/services/` - Business logic (cronJobs.js, factoryService.js)
  - `/src/config/` - Configuration (permissions.js, database.js)
  - `/src/utils/` - Utilities (jwt.js, password.js, logger.js)
  - `/prisma/schema.prisma` - Database schema with complex user roles

### React Native Architecture (Primary Focus)
- **Framework**: Expo 53+ with React Native 0.79+
- **Navigation**: React Navigation 7+ with permission-based routing
- **State Management**: Zustand with persistent storage
- **Authentication**: 
  - Multi-role system (developer, platform_admin, factory roles)
  - Biometric authentication with Expo LocalAuthentication
  - Device binding and secure token storage
- **Key Features**:
  - Camera integration for QR scanning and photo capture
  - GPS location tracking
  - DeepSeek AI analysis integration
  - Offline-first architecture with sync
  - Push notifications
- **Development Strategy**: 9-week phased approach
  - **Phase 0** (1 week): Environment setup
  - **Phase 1** (3 weeks): Complete authentication system migration
  - **Phase 2** (3 weeks): Processing module + DeepSeek LLM integration
  - **Phase 3** (2 weeks): App activation system + production release
- **Module Structure**:
  - `/src/components/` - UI components (auth, permissions, forms)
  - `/src/modules/` - Feature modules (auth, processing, farming, logistics, sales)
  - `/src/services/` - API clients and services (authService, activationService)
  - `/src/navigation/` - Smart navigation with permission guards
  - `/src/store/` - Zustand stores (authStore, navigationStore, permissionStore)
  - `/src/screens/` - Screen components organized by feature

## Database Schema (MySQL/PostgreSQL via Prisma)

The system supports a complex multi-tenant architecture with sophisticated role management:

### Core Models
- `Factory` - Manufacturing facilities with industry/region coding and factory ID generation
- `User` - Factory employees with complex role hierarchy and department structure
- `PlatformAdmin` - Platform-level administrators with system-wide permissions
- `UserWhitelist` - Phone number pre-approval system with expiration management
- `Session` - User session management with device tracking
- `FactorySettings` - Factory-specific configuration
- `UserRoleHistory` - Role change tracking and audit trail

### User Roles & Permissions (8 Role System)
**Platform Roles**: 
- `developer` (system_developer) - Full system access
- `platform_admin` (platform_super_admin) - Platform management
- `platform_operator` - Limited platform operations

**Factory Roles**:
- `factory_super_admin` - Factory-wide admin access
- `permission_admin` - User permission management
- `department_admin` - Department-level administration
- `operator` - Operational access
- `viewer` - Read-only access
- `unactivated` - Pending activation

## Mobile API Architecture

### Mobile-Specific Endpoints (`/api/mobile/*`)
- **Authentication**: Unified login, device binding, biometric support
- **Registration**: Two-phase registration with phone verification
- **File Upload**: Mobile-optimized image upload with compression
- **DeepSeek Integration**: AI analysis with cost control (target: <¥30/month)
- **App Activation**: Device-based activation system
- **Health Check**: Service availability monitoring

### Key Mobile APIs
```javascript
POST /api/mobile/auth/unified-login      // Smart login (platform vs factory user)
POST /api/mobile/auth/register-phase-one // Phone verification stage
POST /api/mobile/auth/register-phase-two // Complete registration
POST /api/mobile/auth/bind-device       // Device binding for security
POST /api/mobile/upload/mobile          // Image upload with optimization
POST /api/mobile/analysis/deepseek      // AI analysis requests
POST /api/mobile/activation/activate    // App activation
```

## Authentication System (Mobile-Optimized)

### Multi-Stage Authentication Flow
1. **Phone Verification** → **Whitelist Check** → **Registration/Login**
2. **Smart User Detection**: System automatically detects platform vs factory users
3. **Device Binding**: Secure device registration with unique device IDs
4. **Biometric Integration**: Fingerprint/Face ID support via Expo LocalAuthentication
5. **Token Management**: AccessToken + RefreshToken + TempToken + DeviceToken

### Mobile Registration Flow
```javascript
// Phase 1: Phone verification and whitelist check
POST /api/mobile/auth/register-phase-one
{
  phoneNumber: "+8613800000000",
  verificationType: "registration"
}

// Phase 2: Complete profile with temporary token
POST /api/mobile/auth/register-phase-two
{
  tempToken: "temp_xxx",
  username: "user123", 
  password: "secure_password",
  fullName: "张三",
  department: "生产部"
  // Additional factory user fields
}
```

### Smart Login System
The unified login automatically determines user type:
- **Platform Users**: Developer, platform admins (priority 1)
- **Factory Users**: Factory roles within specific factories (priority 2)
- **Navigation**: Smart post-login redirection based on role and permissions

## Development Environment Setup

### React Native + Backend Setup (Windows)
**Recommended Approach**: Use `start-backend-rn.cmd`
1. Automatically starts MySQL service
2. Launches backend server (port 3001)
3. Starts Expo React Native development server
4. Opens new terminal windows for each service

### Manual Setup
```bash
# 1. Database Setup
cd backend
cp .env.example .env
# Configure DATABASE_URL in .env
npm run migrate
npm run seed

# 2. Backend
npm run dev

# 3. React Native (new terminal)
cd frontend/CretasFoodTrace  
npx expo start
```

### PowerShell Issues (Windows)
The project includes comprehensive PowerShell profile management:
- **Primary Solution**: Use `start-backend-rn.cmd` (bypasses PowerShell entirely)
- **Alternative**: Use `SOLUTION-HUB.cmd` for guided PowerShell fixes
- **Emergency**: Use `NO-PROFILE-DEV.cmd` for immediate development access
- **Critical Rule**: Never use `Add-Content` to modify PowerShell profiles (causes corruption)

## React Native Development Strategy (9-Week Plan)

### Phase Overview
- **Phase 0** (1 week): Environment setup and project initialization
- **Phase 1** (3 weeks): Complete authentication system migration with 8-role support
- **Phase 2** (3 weeks): Processing module implementation + DeepSeek LLM integration  
- **Phase 3** (2 weeks): App activation system + production release preparation

### Key Development Principles
1. **Mobile-First Design**: Optimize for Android with Material Design 3
2. **Offline-First Architecture**: Core features work without network connectivity
3. **Performance Targets**: <3s startup, <500ms page transitions, <200MB memory
4. **Cost Control**: DeepSeek AI analysis <¥30/month, cache hit rate >60%

## Key Development Patterns

### Mobile Architecture Patterns
- **Permission-Based Navigation**: Routes dynamically adapt to user roles
- **Smart Service Loading**: Services load based on user permissions and network state
- **Biometric Integration**: Seamless fingerprint/Face ID authentication
- **Device Management**: Secure device binding with unique identification

### State Management (Zustand)
```javascript
// Core stores for React Native
/src/store/
├── authStore.ts          // Authentication state and user management
├── navigationStore.ts    // Navigation state and permission-based routing
├── permissionStore.ts    // Role-based permission management
└── index.ts              // Store exports and persistence configuration
```

### Error Handling
- **Backend**: Centralized middleware with mobile-optimized responses
- **Mobile**: User-friendly error messages with offline fallback
- **Logging**: Winston logger with mobile request tracking

## Testing Strategy (Phase 1-3 Frontend Focus)

### 📱 React Native Frontend Testing

#### Component Testing
- **Framework**: React Native Testing Library + Jest
- **Focus Areas**: 
  - UI component rendering and behavior
  - User interaction flows (navigation, forms, buttons)
  - State management (Zustand stores)
  - Permission-based UI changes
- **Command**: `npm test` (in CretasFoodTrace directory)

#### API Interface Testing
- **Mock Data**: Use sample data to test API client interfaces
- **Network Simulation**: Test offline/online state handling
- **Error Handling**: Test API error scenarios without backend
- **Request Formation**: Verify API requests are properly formatted

#### Authentication Flow Testing
- **Login/Logout Flows**: Test complete authentication flows
- **Biometric Integration**: Test biometric authentication flows  
- **Token Management**: Test token storage and refresh logic
- **Permission Routing**: Test role-based navigation

#### Integration Testing
- **Screen Navigation**: Test navigation between screens
- **Form Validation**: Test input validation and error handling
- **Offline Functionality**: Test offline storage and sync
- **Device Features**: Test camera, GPS, notifications

### 🔧 Backend Requirements Validation

#### Requirements Documentation Testing
- **Completeness Check**: Ensure all frontend needs are documented
- **API Specification**: Verify API interfaces are fully specified
- **Data Model Validation**: Check database schema requirements
- **Integration Points**: Validate frontend-backend integration points

#### Post-Development Validation (Phase 4+)
- **Backend Implementation Testing**: Validate implemented backends match requirements
- **API Contract Testing**: Ensure API responses match frontend expectations
- **End-to-End Testing**: Complete system integration testing

## Security Considerations

### Mobile Security
- **Secure Storage**: Expo SecureStore for sensitive data (tokens, biometric settings)
- **Device Binding**: Unique device identification and registration
- **Token Security**: Multi-layer token system (access, refresh, temp, device)
- **Biometric Protection**: Secure biometric authentication with fallback

### API Security
- **Mobile Middleware**: Dedicated authentication for mobile endpoints
- **Rate Limiting**: API call throttling for mobile clients
- **Permission Validation**: Real-time role verification
- **Input Sanitization**: Zod schemas for all mobile API inputs

## Performance Optimization

### Mobile Performance
- **Startup Time**: Target <3 seconds cold start
- **Memory Management**: Target <200MB steady state
- **Bundle Size**: Target <50MB APK
- **Network Optimization**: Request batching and intelligent caching

### DeepSeek LLM Optimization
- **Cost Control**: Intelligent caching (5-minute cache for similar queries)
- **Request Optimization**: Data preprocessing to reduce token usage
- **Fallback Strategy**: Basic analysis when LLM service unavailable
- **Usage Monitoring**: Real-time cost tracking and limits

## Deployment Strategy

### Mobile App Deployment
- **Development**: Expo development builds for testing
- **Staging**: Internal distribution via Expo
- **Production**: Google Play Store release with app activation
- **Enterprise**: APK distribution with activation codes

### Backend Deployment
- **Development**: Local MySQL with backend on port 3001
- **Production**: PostgreSQL on cloud platforms (Neon, Supabase)
- **API Versioning**: Mobile API versioning for backward compatibility

## Common Issues & Solutions (Phase 1-3 Focus)

### 📱 React Native Development Issues

#### Expo/Metro Cache Issues
- **Clear cache**: `npx expo start --clear`
- **Reset Metro**: `npx react-native start --reset-cache`
- **Reinstall dependencies**: `rm -rf node_modules && npm install`
- **Clear Expo cache**: `expo r -c` or `expo start --clear`

#### Device/Emulator Issues
- **Android Emulator**: Ensure Android Studio and AVD properly configured
- **Network Connection**: Use `10.0.2.2:3001` for Android emulator → backend
- **Permissions**: Manually grant camera, location, storage permissions in emulator settings
- **Hot Reload Issues**: Restart Expo development server if hot reload stops working

#### API Interface Development Issues
- **Backend Not Available**: Use mock data to continue frontend development
- **API Design Questions**: Document questions in `backend/rn-update-tableandlogic.md`
- **Response Format Uncertainty**: Create sample response format and document it
- **Network Error Handling**: Implement offline fallback UI for all API calls

#### State Management Issues  
- **Zustand Store Issues**: Verify store persistence configuration
- **Permission State**: Ensure permission state updates trigger UI re-renders
- **Navigation State**: Check navigation state persistence across app restarts

### 🔧 Backend Service Issues (Supporting Only)

#### Backend Health Check
- **Service Status**: Run `npm run check` in backend directory
- **Database Connection**: Verify MySQL service: `sc query MySQL80` (Windows)
- **Port Conflicts**: 
  - Backend API: Ensure port 3001 is available
  - React Native Dev Server: Ensure port 3010 is available
  - MySQL: Ensure port 3306 is available
- **Health Endpoint**: Test `curl http://localhost:3001/api/mobile/health`
- **Port Check Commands (Windows)**:
  ```cmd
  netstat -ano | findstr :3001  # Backend API
  netstat -ano | findstr :3010  # React Native
  netstat -ano | findstr :3306  # MySQL
  ```

**IMPORTANT**: During Phase 1-3, do NOT attempt to fix backend issues by modifying code. Instead:
1. Document the issue in `backend/rn-update-tableandlogic.md`
2. Create workarounds in frontend if possible
3. Continue with frontend development

### 📋 Requirements Documentation Issues

#### Missing Backend Requirements
- **Symptom**: Frontend needs API that doesn't exist
- **Solution**: 
  1. Document exact requirement in `backend/rn-update-tableandlogic.md`
  2. Include API endpoint specification
  3. Create mock data for frontend development
  4. Continue frontend development

#### Unclear API Specifications
- **Symptom**: Unsure about request/response format
- **Solution**:
  1. Research similar patterns in existing codebase
  2. Define proposed API format
  3. Document in requirements file
  4. Implement frontend assuming proposed format

### 💻 Development Environment Issues

#### PowerShell Issues (Windows)
- **Primary Solution**: Use `start-backend-rn.cmd` (bypasses PowerShell entirely)
- **Alternative**: Use `SOLUTION-HUB.cmd` → appropriate fix option
- **Emergency**: Use `NO-PROFILE-DEV.cmd` for immediate access
- **CRITICAL**: Never use `Add-Content` to modify PowerShell profiles

#### Git Workflow Issues
- **Branch Naming**: Use format `feature/rn-phase-X-[feature-name]`
- **Requirements Documentation**: Always commit requirement changes with feature code
- **Code Review**: Focus on API interface design and requirement documentation completeness

## Development Workflow (Phase 1-3)

### 📱 React Native Frontend Development Workflow

#### Daily Development Routine
1. **Start Environment**: Run `start-backend-rn.cmd` (starts MySQL + Backend + React Native)
2. **Check Services**: Verify Expo development server is running
3. **Frontend Focus**: Develop React Native components, screens, and logic
4. **API Interface Design**: Create API client calls (without backend implementation)
5. **Requirements Documentation**: Record any needed backend changes in requirements document
6. **Code Quality**: Follow TypeScript strict mode, no `any` types
7. **Testing**: Test React Native components and user flows

#### Backend Requirements Management Workflow
1. **Identify Backend Need**: When frontend needs backend functionality
2. **Document Requirement**: Add detailed requirement to `backend/rn-update-tableandlogic.md`
3. **Design API Interface**: Create frontend API client interface
4. **Mock Response**: Use sample data for frontend development
5. **Continue Frontend**: Don't wait for backend implementation

#### Requirement Documentation Template
When adding backend requirements, include:
```markdown
### [Feature Name] - [Date]
**Frontend Context**: What frontend feature needs this
**API Endpoint**: POST/GET /api/mobile/[endpoint]
**Request Format**: JSON structure
**Response Format**: Expected response structure
**Database Changes**: New tables/fields needed
**Business Logic**: Backend logic requirements
**Priority**: High/Medium/Low
```

### Git Workflow
- **Feature Branches**: `feature/rn-phase-X-[feature-name]`
- **Commit Messages**: Use Chinese for feature descriptions
- **Code Review Focus**: 
  - React Native component quality
  - API interface design
  - Requirements documentation completeness
  - Mobile performance and UX

### Testing Accounts & Data
- **Username**: `admin`
- **Password**: `Admin@123456`
- **Test Device ID**: `test-device-123`
- **Activation Codes**: `DEV_TEST_2024`, `CRETAS_MOBILE_2024`
- **Test Factory ID**: `FAC001`
- **Test Phone**: `+86138000000000`

## Project Focus Areas (Phase 1-3: Frontend Only)

### 📱 Current Development Priority: React Native Frontend

#### Phase 1 (3 weeks): Authentication System
- **Focus**: Complete React Native authentication UI and flows
- **Key Deliverables**:
  - Login/register screens with 8-role support
  - Biometric authentication integration
  - Permission-based navigation system
  - Token management and secure storage
- **Backend Requirements**: Document all auth-related backend needs in requirements file

#### Phase 2 (3 weeks): Processing Module + Smart Features
- **Focus**: React Native processing module with DeepSeek integration
- **Key Deliverables**:
  - Processing data input forms
  - AI analysis interface (with mock responses)
  - Camera integration for QR scanning
  - GPS location tracking
  - Offline data storage and sync
- **Backend Requirements**: Document processing APIs and DeepSeek integration needs

#### Phase 3 (2 weeks): App Activation & Completion
- **Focus**: App activation system and production readiness
- **Key Deliverables**:
  - Device activation flow
  - Production build optimization
  - Complete testing and QA
  - Requirements documentation review
- **Backend Requirements**: Finalize all backend requirement specifications

### 🎯 Frontend-Only Success Metrics

#### Technical Performance
- **App Startup**: <3s cold start (measured in frontend)
- **Page Transitions**: <500ms navigation (React Navigation)
- **Bundle Size**: <50MB APK (Expo build)
- **Memory Usage**: <200MB steady state (React Native profiling)

#### Functional Completeness
- **UI Components**: 100% of planned screens implemented
- **User Flows**: Complete authentication, processing, navigation flows
- **API Interfaces**: All frontend API clients implemented
- **Offline Functionality**: Local storage and sync mechanisms

#### Requirements Documentation Quality
- **Backend APIs**: Complete API specifications documented
- **Database Schema**: All needed table/field changes documented
- **Business Logic**: All backend logic requirements documented
- **Integration Points**: Clear frontend-backend integration specifications

### 🔄 Post-Phase 3: Backend Development

After Phase 1-3 completion:
1. **Backend Implementation**: Implement all documented requirements
2. **API Development**: Create all specified endpoints
3. **Database Updates**: Apply all schema changes
4. **Integration Testing**: Connect frontend with implemented backend
5. **Production Deployment**: Deploy complete system

This frontend-first approach ensures rapid React Native development while maintaining clear backend requirements for future implementation.