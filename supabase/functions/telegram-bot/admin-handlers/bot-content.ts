import { sendMessage, supabaseAdmin } from "./common.ts";

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
    contentMessage += `📝 *Editable Content (${
      content?.length || 0
    } items):*\\n\\n`;

    const lines: string[] = [];
    const buttons: { text: string; callback_data: string }[][] = [];

    (content || []).forEach((item, index) => {
      const status = item.is_active ? "🟢" : "🔴";
      const preview = item.content_value.substring(0, 50) + "...";
      lines.push(
        `${
          index + 1
        }. ${status} ${item.content_key}\\n   📄 Preview: ${preview}\\n   🕐 Updated: ${
          new Date(item.updated_at).toLocaleDateString()
        }\\n`,
      );
      buttons.push([{
        text: item.content_key,
        callback_data: `edit_content_${item.content_key}`,
      }]);
    });

    contentMessage += lines.join("\\n");

    buttons.push([
      { text: "➕ Add Content", callback_data: "add_new_content" },
      { text: "👀 Preview All", callback_data: "preview_all_content" },
    ]);
    buttons.push([
      { text: "🔄 Refresh", callback_data: "manage_table_bot_content" },
      { text: "🔙 Back", callback_data: "table_management" },
    ]);

    await sendMessage(chatId, contentMessage, { inline_keyboard: buttons });
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
