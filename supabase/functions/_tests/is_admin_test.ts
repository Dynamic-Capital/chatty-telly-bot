import {
  assert,
  assertFalse,
} from "https://deno.land/std@0.224.0/assert/mod.ts";
import { isAdmin } from "../_shared/telegram.ts";

Deno.test("isAdmin accepts IDs with spaces", () => {
  Deno.env.set("TELEGRAM_ADMIN_IDS", "225513686 , 8411280111");
  try {
    assert(isAdmin(225513686));
    assert(isAdmin("8411280111"));
  } finally {
    Deno.env.delete("TELEGRAM_ADMIN_IDS");
  }
});

Deno.test("isAdmin rejects unknown ID", () => {
  Deno.env.set("TELEGRAM_ADMIN_IDS", "225513686");
  try {
    assertFalse(isAdmin("999"));
  } finally {
    Deno.env.delete("TELEGRAM_ADMIN_IDS");
  }
});
