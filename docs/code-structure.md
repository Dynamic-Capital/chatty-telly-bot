# Code Structure Guide for AI Tools

> **AI Development Companion** - This guide helps AI coding tools understand and
> modify the Dynamic Capital VIP Bot codebase effectively.

## 📁 Project Structure

```
dynamic-capital-bot/
├── 📁 types/
│   └── telegram-bot.ts          # Complete TypeScript definitions
├── 📁 docs/
│   ├── api-documentation.md     # Comprehensive API docs
│   ├── code-structure.md        # This file
│   └── deployment-guide.md      # Deployment instructions
├── 📁 src/
│   ├── 📁 components/
│   │   ├── 📁 admin/           # Admin dashboard components
│   │   ├── 📁 auth/            # Authentication components
│   │   └── 📁 ui/              # Reusable UI components
│   ├── 📁 pages/               # React pages
│   └── 📁 integrations/
│       └── supabase/           # Supabase client & types
└── 📁 supabase/
    ├── 📁 functions/
    │   └── 📁 telegram-bot/    # Main bot function
    └── 📁 migrations/          # Database migrations
```

## 🤖 Main Bot Architecture

### Core Files Breakdown

#### `supabase/functions/telegram-bot/index.ts`

**Main bot entry point - 5,963 lines of comprehensive functionality**

```typescript
/**
 * 🎯 MAIN SECTIONS (for AI reference):
 *
 * Lines 1-286:    Security & Rate Limiting System
 * Lines 287-500:  Environment Setup & Database Utils
 * Lines 501-1000: Session Management & Core Functions
 * Lines 1001-2000: Message Handlers & User Commands
 * Lines 2001-3000: Admin Management Functions
 * Lines 3001-4000: Broadcasting & Content Management
 * Lines 4001-5000: Payment & Subscription Handlers
 * Lines 5001-5963: Main Update Router & Callback Handlers
 */

// 🔒 Security Layer (Lines 16-286)
interface RateLimitEntry {/* ... */}
function isRateLimited(userId: string): boolean {/* ... */}
function validateMessage(text: string): boolean {/* ... */}

// 💾 Database Layer (Lines 418-600)
async function getBotContentBatch(
  keys: string[],
): Promise<Map<string, string>> {/* ... */}
async function setBotContent(key: string, value: string): Promise<boolean> {
  /* ... */
}
async function getUserCompleteData(userId: string): Promise<any> {/* ... */}

// 🎭 Session Layer (Lines 323-415)
async function startBotSession(userId: string): Promise<string> {/* ... */}
async function updateBotSession(userId: string): Promise<void> {/* ... */}
async function endBotSession(userId: string): Promise<void> {/* ... */}

// 💬 Message Layer (Lines 700-1200)
async function sendMessage(
  chatId: number,
  text: string,
  keyboard?: any,
): Promise<void> {/* ... */}
async function handleTextMessage(message: TelegramMessage): Promise<void> {
  /* ... */
}
async function handleCallbackQuery(
  query: TelegramCallbackQuery,
): Promise<void> {/* ... */}
```

#### `supabase/functions/telegram-bot/database-utils.ts`

**Database operations utility - Clean, focused functions**

```typescript
/**
 * 🎯 UTILITY SECTIONS:
 *
 * Content Management:    getBotContent(), setBotContent()
 * Settings Management:   getBotSetting(), setBotSetting()
 * VIP Package Ops:      getVipPackages(), createVipPackage()
 * Education Packages:   getEducationPackages(), createEducationPackage()
 * Promotion System:     getActivePromotions(), createPromotion()
 * Admin Logging:        logAdminAction()
 * User Activity:        updateUserActivity()
 */

// Example function signature for AI tools:
export async function getBotContent(
  contentKey: string,
): Promise<string | null> {
  const { data, error } = await supabaseAdmin
    .from("bot_content")
    .select("content_value")
    .eq("content_key", contentKey)
    .eq("is_active", true)
    .single();

  return error ? null : data?.content_value;
}
```

#### `supabase/functions/telegram-bot/admin-handlers.ts`

**Admin interface handlers - Well-structured management functions**

```typescript
/**
 * 🎯 ADMIN SECTIONS:
 *
 * Dashboard:           handleTableManagement()
 * User Management:     handleUserTableManagement()
 * Content Editing:     handleContentManagement()
 * Settings Control:    handleBotSettingsManagement()
 * Analytics Views:     handleTableStatsOverview()
 */

// Example admin handler pattern:
export async function handleUserTableManagement(
  chatId: number,
  userId: string,
): Promise<void> {
  // 1. Permission check
  if (!isAdmin(userId)) return;

  // 2. Fetch data
  const users = await getBotUsers();

  // 3. Format response
  const message = formatUserList(users);
  const keyboard = createUserManagementKeyboard();

  // 4. Send to admin
  await sendMessage(chatId, message, keyboard);
}
```

## 🗄️ Database Schema for AI

### Primary Tables (AI Quick Reference)

```typescript
// 👤 Users & Authentication
interface BotUser {
  id: string; // UUID primary key
  telegram_id: string; // Unique Telegram user ID
  username?: string; // @username
  first_name?: string; // Display name
  is_admin: boolean; // Admin privileges
  is_vip: boolean; // VIP status
  current_plan_id?: string; // Active subscription
  subscription_expires_at?: string; // Expiry date
}

// 💳 Subscriptions & Payments
interface SubscriptionPlan {
  id: string; // UUID primary key
  name: string; // Plan name (e.g., "VIP Monthly")
  price: number; // Price in currency
  currency: string; // "USD", "EUR", etc.
  duration_months: number; // Subscription length
  features: string[]; // Array of features
}

interface Payment {
  id: string; // UUID primary key
  user_id: string; // Links to bot_users
  plan_id: string; // Links to subscription_plans
  amount: number; // Payment amount
  status: "pending" | "completed" | "failed"; // Payment status
  payment_method: string; // "binance_pay", "manual", etc.
}

// 📚 Education System
interface EducationPackage {
  id: string; // UUID primary key
  name: string; // Course name
  price: number; // Course price
  duration_weeks: number; // Course length
  max_students?: number; // Enrollment limit
  current_students: number; // Current enrollments
  is_featured: boolean; // Featured on main menu
}

// 📊 Content & Settings
interface BotContent {
  content_key: string; // Unique identifier (e.g., "welcome_message")
  content_value: string; // The actual content/message
  content_type: "text" | "html"; // Format type
  is_active: boolean; // Whether to use this content
}

interface BotSettings {
  setting_key: string; // Unique identifier (e.g., "auto_delete_enabled")
  setting_value: string; // Setting value (stored as string)
  setting_type: "string" | "number" | "boolean"; // Type hint
}
```

### Relationships (AI Reference)

```typescript
// Foreign Key Relationships
const relationships = {
  // User-centric relationships
  "user_subscriptions.telegram_user_id": "bot_users.telegram_id",
  "payments.user_id": "bot_users.id",
  "education_enrollments.student_telegram_id": "bot_users.telegram_id",

  // Plan relationships
  "user_subscriptions.plan_id": "subscription_plans.id",
  "payments.plan_id": "subscription_plans.id",
  "education_enrollments.package_id": "education_packages.id",

  // Activity tracking
  "user_interactions.telegram_user_id": "bot_users.telegram_id",
  "bot_sessions.telegram_user_id": "bot_users.telegram_id",
  "promotion_usage.telegram_user_id": "bot_users.telegram_id", // one use per promotion enforced
};
```

## 🎛️ Handler Pattern for AI

### Standard Handler Template

```typescript
/**
 * 🤖 COPY THIS TEMPLATE FOR NEW HANDLERS
 * This pattern ensures consistency across the codebase
 */
async function handleNewFeature(
  chatId: number, // Telegram chat ID
  userId: string, // Telegram user ID
  data?: string, // Optional callback data
  context?: any, // Optional additional context
): Promise<void> {
  try {
    // 🔒 Step 1: Security & Validation
    const rateLimitCheck = isRateLimited(userId);
    if (rateLimitCheck.limited) {
      await sendMessage(chatId, getSecurityResponse(rateLimitCheck.reason));
      return;
    }

    // 👤 Step 2: User Authentication & Authorization
    const isAuthorized = await checkUserPermissions(userId, "feature_access");
    if (!isAuthorized) {
      await sendMessage(chatId, "❌ Access denied.");
      return;
    }

    // 📊 Step 3: Data Retrieval
    const userData = await getUserCompleteData(userId);
    const settings = await getBotSettingsBatch([
      "feature_enabled",
      "max_usage",
    ]);
    const content = await getBotContentBatch([
      "feature_message",
      "feature_help",
    ]);

    // ⚙️ Step 4: Business Logic
    const processedData = await processFeatureLogic(userData, data, context);

    // 💾 Step 5: Database Updates
    if (processedData.shouldUpdate) {
      await updateUserActivity(userId, {
        feature_used: "new_feature",
        timestamp: new Date().toISOString(),
        context: processedData.context,
      });
    }

    // 📱 Step 6: Response Generation
    const responseMessage = formatFeatureResponse(processedData, content);
    const responseKeyboard = createFeatureKeyboard(processedData);

    // 📤 Step 7: Send Response
    await sendMessage(chatId, responseMessage, responseKeyboard);

    // 📝 Step 8: Logging (if admin action)
    if (isAdmin(userId)) {
      await logAdminAction(
        userId,
        "feature_access",
        `Used feature: ${data || "default"}`,
        "feature_table",
        processedData.id,
      );
    }

    // 🔄 Step 9: Session Update
    await updateBotSession(userId, {
      lastAction: "new_feature",
      featureData: processedData,
    });
  } catch (error) {
    // 🚨 Error Handling
    console.error(`🚨 Error in handleNewFeature for user ${userId}:`, error);

    // User-friendly error message
    const errorContent = await getBotContent("error_message") ||
      "❌ Something went wrong. Please try again.";
    await sendMessage(chatId, errorContent);

    // Log error for admin review
    await logAdminAction(
      "system",
      "error",
      `handleNewFeature error: ${error.message}`,
      "error_logs",
      null,
      null,
      { error: error.message, userId, chatId },
    );
  }
}
```

### Message Formatting Patterns

```typescript
/**
 * 🎨 MESSAGE FORMATTING STANDARDS
 * Consistent, emoji-rich, mobile-friendly formatting
 */

// ✅ Good Message Format
function formatSuccessMessage(
  title: string,
  details: string[],
  actions?: string[],
): string {
  return `✅ ${title}

📋 Details:
${details.map((detail) => `• ${detail}`).join("\n")}

${
    actions
      ? `\n🎯 Next Steps:\n${actions.map((action) => `• ${action}`).join("\n")}`
      : ""
  }`;
}

// 📊 Data Display Format
function formatTableData(
  title: string,
  data: Array<{ label: string; value: string }>,
): string {
  return `📊 ${title}

${data.map((item) => `• ${item.label}: ${item.value}`).join("\n")}`;
}

// 🎹 Keyboard Creation Pattern
function createActionKeyboard(
  actions: Array<{ text: string; data: string }>,
): TelegramInlineKeyboardMarkup {
  return {
    inline_keyboard: [
      // Group related actions in rows
      ...actions.map((action) => [{
        text: action.text,
        callback_data: action.data,
      }]),
      // Always include back button
      [{ text: "🔙 Back", callback_data: "back_main" }],
    ],
  };
}
```

## 🔧 Configuration for AI

### Environment Variables Pattern

```typescript
/**
 * 🌍 ENVIRONMENT CONFIGURATION
 * All environment variables with AI-friendly descriptions
 */
interface BotEnvironment {
  // 🤖 Required - Telegram Bot Configuration
  TELEGRAM_BOT_TOKEN: string; // Get from @BotFather on Telegram

  // 🗄️ Required - Supabase Configuration
  SUPABASE_URL: string; // Your Supabase project URL
  SUPABASE_SERVICE_ROLE_KEY: string; // Service role key (not anon key!)

  // 🧠 Optional - AI Features
  OPENAI_API_KEY?: string; // For AI-powered FAQ responses

  // 💳 Optional - Payment Processing
  BINANCE_API_KEY?: string; // For Binance Pay integration
  BINANCE_SECRET_KEY?: string; // Binance API secret

  // 🔐 Optional - Additional Services
  VOLET_API_KEY?: string; // Alternative payment processor
}

// ⚙️ Runtime Configuration
const CONFIG = {
  // Security settings
  RATE_LIMITS: {
    REQUESTS_PER_MINUTE: 20,
    COMMANDS_PER_MINUTE: 8,
    IDENTICAL_MESSAGES: 3,
  },

  // Feature toggles
  FEATURES: {
    AI_RESPONSES: true,
    PAYMENT_PROCESSING: true,
    BROADCASTING: true,
    EDUCATION_PACKAGES: true,
  },

  // Admin settings
  ADMIN_CONFIG: {
    AUTO_DELETE_DELAY: 300, // seconds
    SESSION_TIMEOUT: 1800, // seconds
    MAX_BROADCAST_SIZE: 1000, // users
  },
};
```

## 🧠 AI Integration Points

### Adding New AI Features

```typescript
/**
 * 🤖 AI INTEGRATION TEMPLATE
 * Use this pattern for adding new AI-powered features
 */

// 1. Create AI Function
async function processWithAI(
  prompt: string,
  userId: string,
  context?: any,
): Promise<{ response: string; confidence: number }> {
  const openAIResponse = await fetch(
    "https://api.openai.com/v1/chat/completions",
    {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini", // Use latest supported model
        messages: [
          {
            role: "system",
            content:
              "You are a helpful trading assistant for Dynamic Capital VIP Bot.",
          },
          {
            role: "user",
            content: prompt,
          },
        ],
        max_tokens: 500,
        temperature: 0.7,
      }),
    },
  );

  const data = await openAIResponse.json();
  return {
    response: data.choices[0].message.content,
    confidence: 0.9, // Add confidence scoring logic
  };
}

// 2. Integrate with Bot Handler
async function handleAIQuery(
  chatId: number,
  userId: string,
  query: string,
): Promise<void> {
  try {
    // Show typing indicator
    await sendChatAction(chatId, "typing");

    // Process with AI
    const aiResult = await processWithAI(query, userId);

    // Format response
    const response = `🤖 AI Assistant:

${aiResult.response}

💡 Confidence: ${Math.round(aiResult.confidence * 100)}%`;

    await sendMessage(chatId, response);

    // Log AI usage
    await updateUserActivity(userId, {
      ai_query: query,
      ai_response_length: aiResult.response.length,
      ai_confidence: aiResult.confidence,
    });
  } catch (error) {
    await sendMessage(
      chatId,
      "🤖 AI is temporarily unavailable. Please try again later.",
    );
  }
}
```

## 📈 Performance Optimization for AI

### Batch Operations Pattern

```typescript
/**
 * ⚡ PERFORMANCE OPTIMIZATION PATTERNS
 * These patterns ensure efficient database operations
 */

// ✅ Good: Batch database operations
async function efficientDataRetrieval(
  userIds: string[],
): Promise<Map<string, any>> {
  // Single query for multiple users
  const { data } = await supabaseAdmin
    .from("bot_users")
    .select("telegram_id, is_vip, subscription_expires_at")
    .in("telegram_id", userIds);

  // Convert to Map for O(1) lookups
  return new Map(data?.map((user) => [user.telegram_id, user]) || []);
}

// ❌ Bad: Individual queries in loop
async function inefficientDataRetrieval(userIds: string[]): Promise<any[]> {
  const results = [];
  for (const userId of userIds) {
    const { data } = await supabaseAdmin
      .from("bot_users")
      .select("*")
      .eq("telegram_id", userId)
      .single();
    results.push(data);
  }
  return results;
}

// ⚡ Caching Pattern
const contentCache = new Map<string, { value: string; expiry: number }>();

async function getCachedBotContent(key: string): Promise<string | null> {
  const cached = contentCache.get(key);
  const now = Date.now();

  // Return cached if valid
  if (cached && cached.expiry > now) {
    return cached.value;
  }

  // Fetch fresh data
  const fresh = await getBotContent(key);
  if (fresh) {
    contentCache.set(key, {
      value: fresh,
      expiry: now + (5 * 60 * 1000), // 5 minutes
    });
  }

  return fresh;
}
```

## 🧪 Testing Patterns for AI

```typescript
/**
 * 🧪 TESTING TEMPLATES
 * Copy these patterns for testing new features
 */

// Mock Telegram Update
const mockTelegramUpdate: TelegramUpdate = {
  update_id: 123456,
  message: {
    message_id: 789,
    from: {
      id: 987654321,
      is_bot: false,
      first_name: "Test",
      username: "testuser",
    },
    chat: {
      id: 987654321,
      type: "private",
      first_name: "Test",
    },
    date: Math.floor(Date.now() / 1000),
    text: "/start",
  },
};

// Test Helper Functions
async function setupTestUser(
  userId: string,
  options: Partial<BotUser> = {},
): Promise<BotUser> {
  return await supabaseAdmin
    .from("bot_users")
    .upsert({
      telegram_id: userId,
      first_name: "Test User",
      is_admin: false,
      is_vip: false,
      ...options,
    })
    .select()
    .single();
}

async function cleanupTestData(userId: string): Promise<void> {
  await supabaseAdmin.from("bot_users").delete().eq("telegram_id", userId);
  await supabaseAdmin.from("user_sessions").delete().eq(
    "telegram_user_id",
    userId,
  );
  await supabaseAdmin.from("user_interactions").delete().eq(
    "telegram_user_id",
    userId,
  );
}
```

---

## 🎯 AI Development Quick Reference

### Most Important Files for AI Tools

1. **`types/telegram-bot.ts`** - All TypeScript interfaces
2. **`supabase/functions/telegram-bot/index.ts`** - Main bot logic
3. **`supabase/functions/telegram-bot/database-utils.ts`** - Database operations
4. **`supabase/functions/telegram-bot/admin-handlers.ts`** - Admin functions

### Common Modification Patterns

1. **Adding New Commands**: Add to message handler switch statement
2. **Adding Admin Features**: Create new admin handler function
3. **Database Changes**: Update types + database-utils + handler
4. **UI Changes**: Modify keyboard creation functions
5. **AI Features**: Follow AI integration template

### AI Tool Compatibility Features

- ✅ Complete TypeScript definitions
- ✅ Comprehensive JSDoc comments
- ✅ Consistent code patterns
- ✅ Clear separation of concerns
- ✅ Well-documented configuration
- ✅ Error handling templates
- ✅ Testing patterns
- ✅ Performance optimization examples

This structure makes the codebase highly compatible with AI coding tools like
Codex, ChatGPT, and Bolt. All patterns are consistent, well-documented, and easy
to extend or modify.
