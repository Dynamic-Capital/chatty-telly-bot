# Bot Content Keys

The Telegram bot looks up the following keys in the `bot_content` table. If a key is absent, the bot falls back to the default message shown below.

| Key | Default message |
| --- | --- |
| `ask_usage` | Please provide a question. Example: /ask What is trading? |
| `service_unavailable` | Service unavailable. |
| `ask_no_answer` | Unable to get answer. |
| `ask_failed` | Failed to get answer. |
| `shouldibuy_usage` | Please provide an instrument. Example: /shouldibuy XAUUSD |
| `shouldibuy_no_analysis` | Unable to get analysis. |
| `shouldibuy_failed` | Failed to get analysis. |

Admins can override any of these messages by inserting or updating records in the `bot_content` table with the corresponding `content_key`.
