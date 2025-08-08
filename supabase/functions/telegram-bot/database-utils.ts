// Database utility functions for the Telegram bot
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const SUPABASE_URL = Deno.env.get("SUPABASE_URL");
const SUPABASE_SERVICE_ROLE_KEY = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");

const supabaseAdmin = createClient(SUPABASE_URL!, SUPABASE_SERVICE_ROLE_KEY!, {
  auth: { persistSession: false },
});

interface VipPackage {
  id: string;
  name: string;
  price: number;
  currency: string;
  duration_months: number;
  is_lifetime: boolean;
  features: string[];
}

// Content management functions
export async function getBotContent(contentKey: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_content')
      .select('content_value')
      .eq('content_key', contentKey)
      .eq('is_active', true)
      .single();

    if (error) {
      console.error(`Error fetching content for ${contentKey}:`, error);
      
      // If content doesn't exist, create default content
      if (error.code === 'PGRST116') {
        console.log(`Creating default content for ${contentKey}`);
        const defaultContent = await createDefaultContent(contentKey);
        return defaultContent;
      }
      return null;
    }

    return data?.content_value || null;
  } catch (error) {
    console.error(`Exception in getBotContent for ${contentKey}:`, error);
    return null;
  }
}

// Create default content for missing keys
async function createDefaultContent(contentKey: string): Promise<string | null> {
  const defaultContents: Record<string, string> = {
    'welcome_message': `🎯 Welcome to Dynamic Capital VIP Bot!

📈 Get premium trading signals & education
💎 Join our VIP community

👇 Choose what you need:`,
    'about_us': `🏢 About Dynamic Capital

We are a leading trading education and signals provider with years of experience in financial markets.

Our mission is to help traders succeed through:
• Premium trading signals
• Educational resources
• Community support
• Expert guidance`,
    'support_message': `🛟 Need Help?

Our support team is here to assist you!

📞 Contact us:
• Telegram: @DynamicCapital_Support
• Response time: Within 24 hours
• Available: Monday - Friday, 9 AM - 6 PM UTC`,
    'help_message': `❓ Bot Commands & Help

Available commands:
/start - Main menu
/vip - View VIP packages
/help - Show this help
/support - Contact support
/about - About us

Need assistance? Contact @DynamicCapital_Support`,
    'vip_benefits': `💎 VIP Membership Benefits

🚀 Premium Trading Signals
📊 Daily Market Analysis
💬 VIP Community Access
🎓 Educational Resources
📞 Priority Support
💰 Exclusive Promotions`,
    'payment_instructions': `💳 Payment Instructions

We accept:
🏦 Bank Transfer
₿ Cryptocurrency
💳 Binance Pay

After payment, upload your receipt and we'll activate your VIP access within 24 hours.`
  };

  const defaultValue = defaultContents[contentKey];
  if (!defaultValue) return null;

  try {
    const { data, error } = await supabaseAdmin
      .from('bot_content')
      .insert({
        content_key: contentKey,
        content_value: defaultValue,
        content_type: 'text',
        description: `Auto-generated default content for ${contentKey}`,
        is_active: true,
        created_by: 'system',
        last_modified_by: 'system'
      })
      .select('content_value')
      .single();

    if (error) {
      console.error(`Error creating default content for ${contentKey}:`, error);
      return null;
    }

    return data?.content_value || null;
  } catch (error) {
    console.error(`Exception creating default content for ${contentKey}:`, error);
    return null;
  }
}

export async function setBotContent(contentKey: string, contentValue: string, adminId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('bot_content')
      .upsert({
        content_key: contentKey,
        content_value: contentValue,
        last_modified_by: adminId,
        updated_at: new Date().toISOString()
      }, {
        onConflict: 'content_key'
      });

    if (!error) {
      // Log admin action
      await logAdminAction(adminId, 'content_update', `Updated content: ${contentKey}`, 'bot_content', undefined, {}, { content_key: contentKey, content_value: contentValue });
    }

    return !error;
  } catch (error) {
    console.error('Exception in setBotContent:', error);
    return false;
  }
}

// Settings management functions
export async function getBotSetting(settingKey: string): Promise<string | null> {
  try {
    const { data, error: _error } = await supabaseAdmin
      .from('bot_settings')
      .select('setting_value')
      .eq('setting_key', settingKey)
      .eq('is_active', true)
      .single();

    return data?.setting_value || null;
  } catch (error) {
    console.error(`Error fetching setting ${settingKey}:`, error);
    return null;
  }
}

export async function setBotSetting(settingKey: string, settingValue: string, adminId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('bot_settings')
      .upsert({
        setting_key: settingKey,
        setting_value: settingValue,
        updated_at: new Date().toISOString()
      });

    if (!error) {
      await logAdminAction(adminId, 'setting_update', `Updated setting: ${settingKey}`, 'bot_settings', undefined, {}, { setting_key: settingKey, setting_value: settingValue });
    }

    return !error;
  } catch (error) {
    console.error('Exception in setBotSetting:', error);
    return false;
  }
}

export async function getAllBotSettings(): Promise<Record<string, string>> {
  try {
    const { data, error } = await supabaseAdmin
      .from('bot_settings')
      .select('setting_key, setting_value');

    if (error) {
      console.error('Error fetching all bot settings:', error);
      return {};
    }

    const settings: Record<string, string> = {};
    data?.forEach(s => {
      settings[s.setting_key] = s.setting_value;
    });
    return settings;
  } catch (error) {
    console.error('Exception in getAllBotSettings:', error);
    return {};
  }
}

export async function resetBotSettings(
  defaultSettings: Record<string, string>,
  adminId: string
): Promise<boolean> {
  try {
    const rows = Object.entries(defaultSettings).map(([key, value]) => ({
      setting_key: key,
      setting_value: value,
      updated_at: new Date().toISOString()
    }));

    const { error } = await supabaseAdmin
      .from('bot_settings')
      .upsert(rows, { onConflict: 'setting_key' });

    if (!error) {
      await logAdminAction(
        adminId,
        'settings_reset',
        'Reset all bot settings',
        'bot_settings',
        undefined,
        {},
        defaultSettings
      );
    }

    return !error;
  } catch (error) {
    console.error('Exception in resetBotSettings:', error);
    return false;
  }
}

// VIP package management functions
export async function getVipPackages(): Promise<VipPackage[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('subscription_plans')
      .select('*')
      .order('price', { ascending: true });

    if (error) {
      console.error('Error fetching VIP packages:', error);
      return [];
    }

    return data || [];
  } catch (error) {
    console.error('Error fetching VIP packages:', error);
    return [];
  }
}

// Enhanced VIP packages display with better formatting
export async function getFormattedVipPackages(): Promise<string> {
  const packages = await getVipPackages();
  
  if (packages.length === 0) {
    return "💎 *VIP Membership Packages*\n\n❌ No packages available at the moment.";
  }

  let message = `💎 *VIP Membership Packages*\n\n🚀 *Unlock Premium Trading Success!*\n\n`;
  
  packages.forEach((pkg, index) => {
    const discount = pkg.duration_months >= 12 ? '🔥 BEST VALUE' : 
                    pkg.duration_months >= 6 ? '⭐ POPULAR' :
                    pkg.duration_months >= 3 ? '💫 SAVE MORE' : '🎯 STARTER';
    
    const monthlyEquivalent = pkg.duration_months > 0 ? 
      `($${(pkg.price / pkg.duration_months).toFixed(0)}/month)` : '';
    
    const savingsInfo = pkg.duration_months >= 12 ? '💰 Save 35%' :
                       pkg.duration_months >= 6 ? '💰 Save 20%' :
                       pkg.duration_months >= 3 ? '💰 Save 15%' : '';

    message += `${index + 1}. **${pkg.name}** ${discount}\n`;
    message += `   💰 **${pkg.currency} ${pkg.price}**`;
    
    if (pkg.is_lifetime) {
      message += ` - *Lifetime Access*\n`;
    } else {
      message += `/${pkg.duration_months}mo ${monthlyEquivalent}\n`;
      if (savingsInfo) message += `   ${savingsInfo}\n`;
    }
    
    message += `   ✨ **Features:**\n`;
    if (pkg.features && Array.isArray(pkg.features)) {
      pkg.features.forEach((feature: string) => {
        message += `      • ${feature}\n`;
      });
    }
    
    if (pkg.is_lifetime) {
      message += `      • 🌟 All future programs included\n`;
      message += `      • 🔐 Exclusive lifetime member content\n`;
    }
    
    message += `\n`;
  });

  message += `🎁 *Special Benefits:*\n`;
  message += `• 📈 Real-time trading signals\n`;
  message += `• 🏆 VIP community access\n`;
  message += `• 📊 Daily market analysis\n`;
  message += `• 🎓 Educational resources\n`;
  message += `• 💬 Direct mentor support\n\n`;
  
  message += `✅ *Ready to level up your trading?*\nSelect a package below to get started!`;

  return message;
}

export async function createVipPackage(packageData: VipPackage, adminId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('subscription_plans')
      .insert(packageData);

    if (!error) {
      await logAdminAction(adminId, 'package_create', `Created VIP package: ${packageData.name}`, 'subscription_plans', undefined, {}, packageData as unknown as Record<string, unknown>);
    }

    return !error;
  } catch (error) {
    console.error('Exception in createVipPackage:', error);
    return false;
  }
}

export async function updateVipPackage(packageId: string, packageData: Partial<VipPackage>, adminId: string): Promise<boolean> {
  try {
    console.log('Updating VIP package:', { packageId, packageData, adminId });
    
    const { error } = await supabaseAdmin
      .from('subscription_plans')
      .update(packageData)
      .eq('id', packageId);

    if (error) {
      console.error('Database error updating VIP package:', error);
      return false;
    }

    if (!error) {
      await logAdminAction(adminId, 'package_update', `Updated VIP package: ${packageId}`, 'subscription_plans', packageId, {}, packageData);
    }

    return !error;
  } catch (error) {
    console.error('Exception in updateVipPackage:', error);
    return false;
  }
}

// Process text input for plan editing
interface PlanEditSession {
  plan_id?: string;
  awaiting_input?: string;
}

export async function processPlaneEditInput(
  userId: string,
  inputText: string,
  sessionData: PlanEditSession
): Promise<{ success: boolean; message: string; planId?: string }> {
  try {
    const { plan_id: planId, awaiting_input } = sessionData;
    
    if (!planId) {
      return { success: false, message: "❌ Session data corrupted. Please start over." };
    }

    switch (awaiting_input) {
      case 'plan_price': {
        const price = parseFloat(inputText.trim());
        if (isNaN(price) || price <= 0) {
          return { success: false, message: "❌ Invalid price. Please enter a valid number (e.g., 49.99)" };
        }

        const { error } = await supabaseAdmin
          .from('subscription_plans')
          .update({ 
            price: price,
            updated_at: new Date().toISOString()
          })
          .eq('id', planId);

        if (error) {
          console.error('Error updating plan price:', error);
          return { success: false, message: `❌ Database error: ${error.message}` };
        }

        await logAdminAction(userId, 'plan_price_update', `Updated plan price to $${price}`, 'subscription_plans', planId);
        return { 
          success: true, 
          message: `✅ Price updated to $${price} successfully!`,
          planId 
        };
      }

      case 'plan_name': {
        const name = inputText.trim();
        if (!name || name.length < 3) {
          return { success: false, message: "❌ Plan name must be at least 3 characters long." };
        }

        const { error } = await supabaseAdmin
          .from('subscription_plans')
          .update({ 
            name: name,
            updated_at: new Date().toISOString()
          })
          .eq('id', planId);

        if (error) {
          console.error('Error updating plan name:', error);
          return { success: false, message: `❌ Database error: ${error.message}` };
        }

        await logAdminAction(userId, 'plan_name_update', `Updated plan name to "${name}"`, 'subscription_plans', planId);
        return { 
          success: true, 
          message: `✅ Plan name updated to "${name}" successfully!`,
          planId 
        };
      }

      case 'plan_duration': {
        const input = inputText.trim().toLowerCase();
        let isLifetime = false;
        let durationMonths = 0;

        if (input === 'lifetime') {
          isLifetime = true;
          durationMonths = 0;
        } else {
          const duration = parseInt(input);
          if (isNaN(duration) || duration <= 0) {
            return { success: false, message: "❌ Invalid duration. Enter a number (e.g., 12) or 'lifetime'" };
          }
          durationMonths = duration;
        }

        const { error } = await supabaseAdmin
          .from('subscription_plans')
          .update({ 
            duration_months: durationMonths,
            is_lifetime: isLifetime,
            updated_at: new Date().toISOString()
          })
          .eq('id', planId);

        if (error) {
          console.error('Error updating plan duration:', error);
          return { success: false, message: `❌ Database error: ${error.message}` };
        }

        const durationText = isLifetime ? 'Lifetime' : `${durationMonths} months`;
        await logAdminAction(userId, 'plan_duration_update', `Updated plan duration to ${durationText}`, 'subscription_plans', planId);
        return { 
          success: true, 
          message: `✅ Duration updated to ${durationText} successfully!`,
          planId 
        };
      }

      case 'plan_add_feature': {
        const feature = inputText.trim();
        if (!feature || feature.length < 3) {
          return { success: false, message: "❌ Feature description must be at least 3 characters long." };
        }

        // Get current features
        const { data: plan, error: fetchError } = await supabaseAdmin
          .from('subscription_plans')
          .select('features')
          .eq('id', planId)
          .single();

        if (fetchError || !plan) {
          return { success: false, message: "❌ Error fetching current plan features." };
        }

        const currentFeatures = plan.features || [];
        const updatedFeatures = [...currentFeatures, feature];

        const { error } = await supabaseAdmin
          .from('subscription_plans')
          .update({ 
            features: updatedFeatures,
            updated_at: new Date().toISOString()
          })
          .eq('id', planId);

        if (error) {
          console.error('Error adding plan feature:', error);
          return { success: false, message: `❌ Database error: ${error.message}` };
        }

        await logAdminAction(userId, 'plan_feature_add', `Added feature "${feature}" to plan`, 'subscription_plans', planId);
        return { 
          success: true, 
          message: `✅ Feature "${feature}" added successfully!`,
          planId 
        };
      }

      case 'create_vip_plan': {
        return await processCreatePlanInput(userId, inputText);
      }

      default:
        return { success: false, message: "❌ Unknown input type. Please start over." };
    }
  } catch (error) {
    console.error('Error in processPlaneEditInput:', error);
    return { success: false, message: "❌ Unexpected error occurred. Please try again." };
  }
}

// Process plan creation input
async function processCreatePlanInput(userId: string, inputText: string): Promise<{ success: boolean; message: string }> {
  try {
    const lines = inputText.split('\n').map(line => line.trim()).filter(line => line);
    interface PlanData { features?: string[]; [key: string]: unknown }
    const planData: PlanData = {};

    for (const line of lines) {
      const [key, ...valueParts] = line.split(':');
      const value = valueParts.join(':').trim();
      
      if (!key || !value) continue;

      const keyLower = key.toLowerCase().trim();
      
      switch (keyLower) {
        case 'name':
          planData.name = value;
          break;
        case 'price': {
          const price = parseFloat(value);
          if (isNaN(price) || price <= 0) {
            return { success: false, message: "❌ Invalid price format. Use numbers only (e.g., 49.99)" };
          }
          planData.price = price;
          break;
        }
        case 'duration':
          if (value.toLowerCase() === 'lifetime') {
            planData.is_lifetime = true;
            planData.duration_months = 0;
          } else {
            const duration = parseInt(value);
            if (isNaN(duration) || duration <= 0) {
              return { success: false, message: "❌ Invalid duration. Use numbers (e.g., 12) or 'lifetime'" };
            }
            planData.is_lifetime = false;
            planData.duration_months = duration;
          }
          break;
        case 'currency':
          planData.currency = value.toUpperCase();
          break;
        case 'features':
          planData.features = value.split(',').map(f => f.trim()).filter(f => f);
          break;
      }
    }

    // Validate required fields
    if (!planData.name) {
      return { success: false, message: "❌ Plan name is required" };
    }
    if (!planData.price) {
      return { success: false, message: "❌ Plan price is required" };
    }
    if (!('is_lifetime' in planData)) {
      return { success: false, message: "❌ Plan duration is required" };
    }
    if (!planData.features || planData.features.length === 0) {
      return { success: false, message: "❌ At least one feature is required" };
    }

    // Set defaults
    planData.currency = planData.currency || 'USD';

    // Create the plan
    const { data: newPlan, error } = await supabaseAdmin
      .from('subscription_plans')
      .insert(planData)
      .select()
      .single();

    if (error) {
      console.error('Error creating plan:', error);
      return { success: false, message: `❌ Database error: ${error.message}` };
    }

    await logAdminAction(userId, 'plan_create', `Created VIP plan: ${planData.name}`, 'subscription_plans', newPlan.id);
    
    const durationText = planData.is_lifetime ? 'Lifetime' : `${planData.duration_months} months`;
    return { 
      success: true, 
      message: `✅ *Plan Created Successfully!*\n\n` +
               `**${planData.name}**\n` +
               `💰 ${planData.currency} ${planData.price}\n` +
               `⏰ ${durationText}\n` +
               `✨ ${planData.features.length} features`
    };
  } catch (error) {
    console.error('Error in processCreatePlanInput:', error);
    return { success: false, message: "❌ Error creating plan. Please check the format and try again." };
  }
}
export async function deleteVipPackage(packageId: string, adminId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('subscription_plans')
      .delete()
      .eq('id', packageId);

    if (!error) {
      await logAdminAction(adminId, 'package_delete', `Deleted VIP package: ${packageId}`, 'subscription_plans', packageId, {}, {});
    }

    return !error;
  } catch (error) {
    console.error('Exception in deleteVipPackage:', error);
    return false;
  }
}

// Education package management functions
export async function getEducationPackages(): Promise<Record<string, unknown>[]> {
  try {
    const { data, error: _error } = await supabaseAdmin
      .from('education_packages')
      .select('*')
      .eq('is_active', true)
      .order('price', { ascending: true });

    return data || [];
  } catch (error) {
    console.error('Error fetching education packages:', error);
    return [];
  }
}

export async function createEducationPackage(packageData: Record<string, unknown>, adminId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('education_packages')
      .insert(packageData);

    if (!error) {
      await logAdminAction(adminId, 'edu_package_create', `Created education package: ${packageData.name}`, 'education_packages', undefined, {}, packageData);
    }

    return !error;
  } catch (error) {
    console.error('Exception in createEducationPackage:', error);
    return false;
  }
}

// Promotion management functions
export async function getActivePromotions(): Promise<Record<string, unknown>[]> {
  try {
    const { data, error: _error } = await supabaseAdmin
      .from('promotions')
      .select('*')
      .eq('is_active', true)
      .gte('valid_until', new Date().toISOString())
      .order('created_at', { ascending: false });

    return data || [];
  } catch (error) {
    console.error('Error fetching promotions:', error);
    return [];
  }
}

// Contact link management functions
interface ContactLink {
  display_name: string;
  url: string;
  icon_emoji: string;
}

export async function getContactLinks(): Promise<ContactLink[]> {
  try {
    const { data, error } = await supabaseAdmin
      .from('contact_links')
      .select('display_name, url, icon_emoji')
      .eq('is_active', true)
      .order('display_order', { ascending: true });

    if (error) {
      console.error('Error fetching contact links:', error);
      return [];
    }

    return data as ContactLink[];
  } catch (error) {
    console.error('Exception in getContactLinks:', error);
    return [];
  }
}

export async function createPromotion(promoData: Record<string, unknown>, adminId: string): Promise<boolean> {
  try {
    const { error } = await supabaseAdmin
      .from('promotions')
      .insert(promoData);

    if (!error) {
      await logAdminAction(adminId, 'promo_create', `Created promotion: ${promoData.code}`, 'promotions', undefined, {}, promoData);
    }

    return !error;
  } catch (error) {
    console.error('Exception in createPromotion:', error);
    return false;
  }
}

// Admin logging function
export async function logAdminAction(
  adminId: string,
  actionType: string,
  description: string,
  affectedTable?: string,
  affectedRecordId?: string,
  oldValues?: Record<string, unknown>,
  newValues?: Record<string, unknown>
): Promise<void> {
  try {
    await supabaseAdmin
      .from('admin_logs')
      .insert({
        admin_telegram_id: adminId,
        action_type: actionType,
        action_description: description,
        affected_table: affectedTable,
        affected_record_id: affectedRecordId,
        old_values: oldValues,
        new_values: newValues
      });
  } catch (error) {
    console.error('Error logging admin action:', error);
  }
}

// User activity functions
export async function updateUserActivity(telegramUserId: string, activityData: Record<string, unknown> = {}): Promise<void> {
  try {
    // Update user's last activity
    await supabaseAdmin
      .from('bot_users')
      .upsert({
        telegram_id: telegramUserId,
        updated_at: new Date().toISOString(),
        follow_up_count: 0 // Reset follow-up count on activity
      }, {
        onConflict: 'telegram_id'
      });

    // Update active session
    await supabaseAdmin
      .from('user_sessions')
      .update({
        last_activity: new Date().toISOString(),
        session_data: activityData
      })
      .eq('telegram_user_id', telegramUserId)
      .eq('is_active', true);

    // Track interaction
    await supabaseAdmin
      .from('user_interactions')
      .insert({
        telegram_user_id: telegramUserId,
        interaction_type: 'message',
        interaction_data: activityData,
        created_at: new Date().toISOString()
      });

  } catch (error) {
    console.error('Error updating user activity:', error);
  }
}

// Utility function to format content with variables
export function formatContent(content: string, variables: Record<string, string>): string {
  let formattedContent = content;
  
  Object.entries(variables).forEach(([key, value]) => {
    const placeholder = `{${key}}`;
    formattedContent = formattedContent.replace(new RegExp(placeholder, 'g'), value || '');
  });
  
  return formattedContent;
}