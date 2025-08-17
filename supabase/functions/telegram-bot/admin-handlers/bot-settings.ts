import { supabaseAdmin, sendMessage } from "./common.ts";
import { logAdminAction } from "../database-utils.ts";

export async function handleBotSettingsManagement(
  chatId: number,
  _userId: string,
): Promise<void> {
  try {
    const { data: settings, error: _error } = await supabaseAdmin
      .from("bot_settings")
      .select("*")
      .order("setting_key", { ascending: true });

    let settingsMessage = `⚙️ *Bot Settings Management*\n\n`;
    settingsMessage += `🔧 *Current Settings (${
      settings?.length || 0
    } items):*\n\n`;

    const settingTypes: Record<string, string> = {
      "session_timeout_minutes": "🕐 Session Timeout",
      "follow_up_delay_minutes": "📬 Follow-up Delay",
      "max_follow_ups": "🔢 Max Follow-ups",
      "maintenance_mode": "🔧 Maintenance Mode",
      "auto_welcome": "🚀 Auto Welcome",
      "admin_notifications": "🔔 Admin Notifications",
    };

    settings?.forEach(
      (
        setting: {
          setting_key: keyof typeof settingTypes;
          is_active: boolean;
          setting_value: string;
          updated_at: string;
        },
        index: number,
      ) => {
        const displayName = settingTypes[setting.setting_key] ||
          `⚙️ ${setting.setting_key}`;
        const status = setting.is_active ? "🟢" : "🔴";

        settingsMessage += `${index + 1}. ${status} ${displayName}\n`;
        settingsMessage += `   📄 Value: \`${setting.setting_value}\`\n`;
        settingsMessage += `   🕐 Updated: ${
          new Date(setting.updated_at).toLocaleDateString()
        }\n\n`;
      },
    );

    const settingsKeyboard = {
      inline_keyboard: [
        [
          {
            text: "🕐 Session Config",
            callback_data: "config_session_settings",
          },
          {
            text: "📬 Follow-up Setup",
            callback_data: "config_followup_settings",
          },
        ],
        [
          { text: "🔧 Maintenance", callback_data: "toggle_maintenance_mode" },
          { text: "🚀 Auto Features", callback_data: "config_auto_features" },
        ],
        [
          { text: "🔔 Notifications", callback_data: "config_notifications" },
          { text: "⚡ Performance", callback_data: "config_performance" },
        ],
        [
          { text: "➕ Add Setting", callback_data: "add_new_setting" },
          { text: "💾 Backup Config", callback_data: "backup_bot_settings" },
        ],
        [
          { text: "🔄 Refresh", callback_data: "manage_table_bot_settings" },
          { text: "🔙 Back", callback_data: "table_management" },
        ],
        [
          { text: "🚦 Feature Flags", callback_data: "feature_flags" },
        ],
      ],
    };

    await sendMessage(chatId, settingsMessage, settingsKeyboard);
  } catch (error) {
    console.error("Error in bot settings management:", error);
    await sendMessage(
      chatId,
      "❌ Error fetching bot settings. Please try again.",
    );
  }
}

export async function handleConfigSessionSettings(
  chatId: number,
  _userId: string,
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("bot_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["session_timeout_minutes"]);
    if (error) throw error;
    let msg = "🕐 *Session Settings*\n\n";
    (data || []).forEach((row: { setting_key: string; setting_value: string }) => {
      msg += `• ${row.setting_key}: \`${row.setting_value}\`\n`;
    });
    const keyboard = {
      inline_keyboard: [[
        { text: "⬅️ Back", callback_data: "manage_table_bot_settings" },
      ]],
    };
    await sendMessage(chatId, msg, keyboard);
  } catch (err) {
    console.error("Error in handleConfigSessionSettings:", err);
    await sendMessage(chatId, "❌ Error fetching session settings.");
  }
}

export async function handleConfigFollowupSettings(
  chatId: number,
  _userId: string,
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("bot_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["follow_up_delay_minutes", "max_follow_ups"]);
    if (error) throw error;
    let msg = "📬 *Follow-up Settings*\n\n";
    (data || []).forEach((row: { setting_key: string; setting_value: string }) => {
      msg += `• ${row.setting_key}: \`${row.setting_value}\`\n`;
    });
    const keyboard = {
      inline_keyboard: [[
        { text: "⬅️ Back", callback_data: "manage_table_bot_settings" },
      ]],
    };
    await sendMessage(chatId, msg, keyboard);
  } catch (err) {
    console.error("Error in handleConfigFollowupSettings:", err);
    await sendMessage(chatId, "❌ Error fetching follow-up settings.");
  }
}

export async function handleToggleMaintenanceMode(
  chatId: number,
  userId: string,
): Promise<void> {
  try {
    const { data } = await supabaseAdmin
      .from("bot_settings")
      .select("id, setting_value")
      .eq("setting_key", "maintenance_mode")
      .maybeSingle();
    const current = (data?.setting_value || "false").toLowerCase() === "true";
    await supabaseAdmin
      .from("bot_settings")
      .update({ setting_value: current ? "false" : "true" })
      .eq("id", data?.id);
    await logAdminAction(
      userId,
      "toggle_maintenance_mode",
      `maintenance_mode=${current ? "false" : "true"}`,
      "bot_settings",
    );
    const msg = `Maintenance mode ${current ? "disabled" : "enabled"}.`;
    const keyboard = {
      inline_keyboard: [[
        { text: "⬅️ Back", callback_data: "manage_table_bot_settings" },
      ]],
    };
    await sendMessage(chatId, msg, keyboard);
  } catch (err) {
    console.error("Error in handleToggleMaintenanceMode:", err);
    await sendMessage(chatId, "❌ Error toggling maintenance mode.");
  }
}

export async function handleConfigAutoFeatures(
  chatId: number,
  _userId: string,
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("bot_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["auto_welcome"]);
    if (error) throw error;
    let msg = "🚀 *Auto Features*\n\n";
    (data || []).forEach((row: { setting_key: string; setting_value: string }) => {
      msg += `• ${row.setting_key}: \`${row.setting_value}\`\n`;
    });
    const keyboard = {
      inline_keyboard: [[
        { text: "⬅️ Back", callback_data: "manage_table_bot_settings" },
      ]],
    };
    await sendMessage(chatId, msg, keyboard);
  } catch (err) {
    console.error("Error in handleConfigAutoFeatures:", err);
    await sendMessage(chatId, "❌ Error fetching auto feature settings.");
  }
}

export async function handleConfigNotifications(
  chatId: number,
  _userId: string,
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("bot_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["admin_notifications"]);
    if (error) throw error;
    let msg = "🔔 *Notification Settings*\n\n";
    (data || []).forEach((row: { setting_key: string; setting_value: string }) => {
      msg += `• ${row.setting_key}: \`${row.setting_value}\`\n`;
    });
    const keyboard = {
      inline_keyboard: [[
        { text: "⬅️ Back", callback_data: "manage_table_bot_settings" },
      ]],
    };
    await sendMessage(chatId, msg, keyboard);
  } catch (err) {
    console.error("Error in handleConfigNotifications:", err);
    await sendMessage(chatId, "❌ Error fetching notification settings.");
  }
}

export async function handleConfigPerformance(
  chatId: number,
  _userId: string,
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("bot_settings")
      .select("setting_key, setting_value")
      .in("setting_key", ["auto_delete_delay_seconds"]);
    if (error) throw error;
    let msg = "⚡ *Performance Settings*\n\n";
    (data || []).forEach((row: { setting_key: string; setting_value: string }) => {
      msg += `• ${row.setting_key}: \`${row.setting_value}\`\n`;
    });
    const keyboard = {
      inline_keyboard: [[
        { text: "⬅️ Back", callback_data: "manage_table_bot_settings" },
      ]],
    };
    await sendMessage(chatId, msg, keyboard);
  } catch (err) {
    console.error("Error in handleConfigPerformance:", err);
    await sendMessage(chatId, "❌ Error fetching performance settings.");
  }
}

export async function handleAddNewSetting(
  chatId: number,
  _userId: string,
): Promise<void> {
  try {
    const { count } = await supabaseAdmin
      .from("bot_settings")
      .select("id", { count: "exact", head: true });
    const msg =
      `➕ *Add New Setting*\n\nCurrent settings: ${count ?? 0}.\nSend new setting in the format \`key=value\`.`;
    const keyboard = {
      inline_keyboard: [[
        { text: "⬅️ Back", callback_data: "manage_table_bot_settings" },
      ]],
    };
    await sendMessage(chatId, msg, keyboard);
  } catch (err) {
    console.error("Error in handleAddNewSetting:", err);
    await sendMessage(chatId, "❌ Error preparing to add setting.");
  }
}

export async function handleBackupBotSettings(
  chatId: number,
  userId: string,
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("bot_settings")
      .select("setting_key, setting_value, is_active")
      .order("setting_key", { ascending: true });
    if (error) throw error;
    const backup = JSON.stringify(data ?? [], null, 2);
    const keyboard = {
      inline_keyboard: [[
        { text: "⬅️ Back", callback_data: "manage_table_bot_settings" },
      ]],
    };
    await sendMessage(
      chatId,
      `💾 *Bot Settings Backup*\n\n\`\`\`json\n${backup}\n\`\`\``,
      keyboard,
    );
    await logAdminAction(
      userId,
      "backup_bot_settings",
      "Exported bot settings",
      "bot_settings",
    );
  } catch (err) {
    console.error("Error in handleBackupBotSettings:", err);
    await sendMessage(chatId, "❌ Error backing up settings.");
  }
}

