import { supabaseAdmin, sendMessage } from "./common.ts";

export async function handleContentManagement(
  chatId: number,
  _userId: string,
): Promise<void> {
  try {
    const { data: content, error } = await supabaseAdmin
      .from("bot_content")
      .select("*")
      .order("content_key", { ascending: true });

    if (error) {
      console.error("Error fetching bot content:", error);
      await sendMessage(
        chatId,
        "❌ Error fetching content data. Please try again.",
      );
      return;
    }

    let contentMessage = `📱 *Bot Content Management*\\n\\n`;
    contentMessage += `📝 *Editable Content (${content?.length || 0} items):*\\n\\n`;

    const contentTypes: Record<string, string> = {
      "welcome_message": "🚀 Welcome Message",
      "about_us": "🏢 About Us",
      "support_message": "🛟 Support Info",
      "terms_conditions": "📋 Terms & Conditions",
      "faq_general": "❓ FAQ Content",
      "maintenance_message": "🔧 Maintenance Notice",
      "vip_benefits": "💎 VIP Benefits",
      "payment_instructions": "💳 Payment Instructions",
      "help_message": "❓ Help Content",
    };

    content?.forEach(
      (
        item: {
          content_key: keyof typeof contentTypes;
          is_active: boolean;
          content_value: string;
          updated_at: string;
        },
        index: number,
      ) => {
        const displayName = contentTypes[item.content_key] ||
          `📄 ${item.content_key}`;
        const status = item.is_active ? "🟢" : "🔴";
        const preview = item.content_value.substring(0, 50) + "...";

        contentMessage += `${index + 1}. ${status} ${displayName}\\n`;
        contentMessage += `   📄 Preview: ${preview}\\n`;
        contentMessage += `   🕐 Updated: ${
          new Date(item.updated_at).toLocaleDateString()
        }\\n\\n`;
      },
    );

    const contentKeyboard = {
      inline_keyboard: [
        [
          {
            text: "🚀 Welcome Msg",
            callback_data: "edit_content_welcome_message",
          },
          { text: "🏢 About Us", callback_data: "edit_content_about_us" },
        ],
        [
          { text: "🛟 Support", callback_data: "edit_content_support_message" },
          { text: "📋 Terms", callback_data: "edit_content_terms_conditions" },
        ],
        [
          { text: "❓ FAQ", callback_data: "edit_content_faq_general" },
          {
            text: "🔧 Maintenance",
            callback_data: "edit_content_maintenance_message",
          },
        ],
        [
          {
            text: "💎 VIP Benefits",
            callback_data: "edit_content_vip_benefits",
          },
          {
            text: "💳 Payment Info",
            callback_data: "edit_content_payment_instructions",
          },
        ],
        [
          { text: "➕ Add Content", callback_data: "add_new_content" },
          { text: "👀 Preview All", callback_data: "preview_all_content" },
        ],
        [
          { text: "🔄 Refresh", callback_data: "manage_table_bot_content" },
          { text: "🔙 Back", callback_data: "table_management" },
        ],
      ],
    };

    await sendMessage(chatId, contentMessage, contentKeyboard);
  } catch (error) {
    console.error("Error in content management:", error);
    await sendMessage(
      chatId,
      "❌ Error fetching content data. Please try again.",
    );
  }
}

export async function handleEditContent(
  chatId: number,
  _userId: string,
  contentKey: string,
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("bot_content")
      .select("content_value")
      .eq("content_key", contentKey)
      .maybeSingle();
    if (error) throw error;
    const current = data?.content_value ?? "";
    const msg =
      `📝 *Editing ${contentKey}*\\n\\nCurrent value:\n${current}\n\nSend new content to update this entry.`;
    const keyboard = {
      inline_keyboard: [[
        { text: "⬅️ Back", callback_data: "manage_table_bot_content" },
      ]],
    };
    await sendMessage(chatId, msg, keyboard);
  } catch (err) {
    console.error("Error in handleEditContent:", err);
    await sendMessage(chatId, "❌ Error preparing content for edit.");
  }
}

export async function handleAddNewContent(
  chatId: number,
  _userId: string,
): Promise<void> {
  try {
    const msg =
      "➕ *Add New Content*\\n\\nSend new content in the format `key=Your content here`.";
    const keyboard = {
      inline_keyboard: [[
        { text: "⬅️ Back", callback_data: "manage_table_bot_content" },
      ]],
    };
    await sendMessage(chatId, msg, keyboard);
  } catch (err) {
    console.error("Error in handleAddNewContent:", err);
    await sendMessage(chatId, "❌ Error preparing to add content.");
  }
}

export async function handlePreviewAllContent(
  chatId: number,
  _userId: string,
): Promise<void> {
  try {
    const { data, error } = await supabaseAdmin
      .from("bot_content")
      .select("content_key, content_value")
      .order("content_key", { ascending: true });
    if (error) throw error;
    const lines = (data || []).map(
      (row: { content_key: string; content_value: string }) =>
        `• ${row.content_key}: ${row.content_value}`,
    );
    const msg = `👀 *All Bot Content*\\n\\n${lines.join("\\n")}`;
    const keyboard = {
      inline_keyboard: [[
        { text: "⬅️ Back", callback_data: "manage_table_bot_content" },
      ]],
    };
    await sendMessage(chatId, msg, keyboard);
  } catch (err) {
    console.error("Error in handlePreviewAllContent:", err);
    await sendMessage(chatId, "❌ Error fetching content preview.");
  }
}

