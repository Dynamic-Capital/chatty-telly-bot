import SupabaseClient from './SupabaseClient.d.ts';
import type { GenericSchema, SupabaseClientOptions } from './lib/types.d.ts';
export * from 'https://esm.sh/@supabase/auth-js@2.71.1/dist/module/index.d.ts';
export type { User as AuthUser, Session as AuthSession } from 'https://esm.sh/@supabase/auth-js@2.71.1/dist/module/index.d.ts';
export { type PostgrestResponse, type PostgrestSingleResponse, type PostgrestMaybeSingleResponse, PostgrestError, } from 'https://esm.sh/@supabase/postgrest-js@1.19.4/dist/cjs/index.d.ts';
export { FunctionsHttpError, FunctionsFetchError, FunctionsRelayError, FunctionsError, type FunctionInvokeOptions, FunctionRegion, } from 'https://esm.sh/@supabase/functions-js@2.4.5/dist/module/index.d.ts';
export * from 'https://esm.sh/@supabase/realtime-js@2.15.0/dist/module/index.d.ts';
export { default as SupabaseClient } from './SupabaseClient.d.ts';
export type { SupabaseClientOptions, QueryResult, QueryData, QueryError } from './lib/types.d.ts';
/**
 * Creates a new Supabase Client.
 */
export declare const createClient: <Database = any, SchemaName extends string & keyof Database = "public" extends keyof Database ? "public" : string & keyof Database, Schema extends GenericSchema = Database[SchemaName] extends GenericSchema ? Database[SchemaName] : any>(supabaseUrl: string, supabaseKey: string, options?: SupabaseClientOptions<SchemaName> | undefined) => SupabaseClient<Database, SchemaName, Schema>;
//# sourceMappingURL=index.d.ts.map
