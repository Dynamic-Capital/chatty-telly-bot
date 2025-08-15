import { supabaseAdmin, sendMessage } from "./common.ts";

export async function handleAutoReplyTemplatesManagement(
  chatId: number,
  _userId: string,
): Promise<void> {
  try {
    const { data: templates, error } = await supabaseAdmin
      .from("auto_reply_templates")
      .select("id,name,trigger_type,is_active,created_at")
      .order("created_at", { ascending: false })
      .limit(10);

    if (error) {
      console.error("Error fetching auto reply templates:", error);
      await sendMessage(
        chatId,
        "❌ Error fetching auto reply templates. Please try again.",
      );
      return;
    }

    const total = await supabaseAdmin
      .from("auto_reply_templates")
      .select("count", { count: "exact" });
    const active = await supabaseAdmin
      .from("auto_reply_templates")
      .select("count", { count: "exact" })
      .eq("is_active", true);

    let msg = `📝 *Auto Reply Templates Management*\\n\\n`;
    msg += `📊 *Statistics:*\\n`;
    msg += `• Total Templates: ${total.count || 0}\\n`;
    msg += `• Active Templates: ${active.count || 0}\\n\\n`;
    msg += `🕒 *Recent Templates:*\\n`;
    templates?.forEach(
      (
        t: { name?: string; trigger_type?: string; is_active?: boolean },
        idx: number,
      ) => {
        const status = t.is_active ? "🟢" : "🔴";
        msg += `${idx + 1}. ${status} ${t.name || "(untitled)"} — ${
          t.trigger_type || ""
        }\\n`;
      },
    );

    const keyboard = {
      inline_keyboard: [
        [
          { text: "🔍 View", callback_data: "view_auto_reply" },
          { text: "➕ Create", callback_data: "create_auto_reply" },
        ],
        [
          { text: "✏️ Edit", callback_data: "edit_auto_reply" },
          { text: "🗑️ Delete", callback_data: "delete_auto_reply" },
        ],
        [
          { text: "📤 Export", callback_data: "export_auto_reply_templates" },
        ],
        [
          {
            text: "🔄 Refresh",
            callback_data: "manage_table_auto_reply_templates",
          },
          { text: "🔙 Back", callback_data: "table_management" },
        ],
      ],
    };

    await sendMessage(chatId, msg, keyboard);
  } catch (error) {
    console.error("Error in auto reply templates management:", error);
    await sendMessage(
      chatId,
      "❌ Error fetching auto reply templates. Please try again.",
    );
  }
}
