export function createClient() {
  const state = globalThis.__SUPA_MOCK__ || { tables: {} };
  return {
    from(table) {
      const rows = state.tables[table] || [];
      let col = null;
      let val = null;
      let op = null;
      let payload = null;
      let lastInsert = null;
      const api = {
        select() { return api; },
        insert(vals) {
          op = "insert";
          const arr = Array.isArray(vals) ? vals : [vals];
          arr.forEach((v) => rows.push(v));
          lastInsert = arr[0];
          return api;
        },
        update(vals) {
          op = "update";
          payload = vals;
          return api;
        },
        upsert(vals) {
          const arr = Array.isArray(vals) ? vals : [vals];
          arr.forEach((v) => {
            const idx = rows.findIndex((r) => String(r.telegram_user_id) === String(v.telegram_user_id));
            if (idx >= 0) rows[idx] = { ...rows[idx], ...v };
            else rows.push(v);
          });
          return Promise.resolve({ data: arr, error: null });
        },
        eq(c, v) {
          col = c;
          val = v;
          if (op === "update") {
            const r = rows.find((r) => String(r[col]) === String(val));
            if (r) Object.assign(r, payload);
            return Promise.resolve({ data: r ? [r] : [], error: null });
          }
          return api;
        },
        single: async () => {
          if (op === "insert") return { data: lastInsert, error: null };
          const r = rows.find((r) => col ? String(r[col]) === String(val) : true);
          return { data: r, error: null };
        },
        maybeSingle: async () => {
          const r = rows.find((r) => col ? String(r[col]) === String(val) : true);
          return { data: r || null, error: null };
        },
      };
      return api;
    },
  };
}
