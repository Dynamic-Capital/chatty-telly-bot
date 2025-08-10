# Index Advisor

This project integrates the
[Supabase Index Advisor](https://github.com/supabase/index_advisor) PostgreSQL
extension.

The migration at
`supabase/migrations/20250808054000_add_index_advisor_extension.sql` enables the
`hypopg` and `index_advisor` extensions so that queries can be analyzed for
potential index improvements.

To install the extension locally, follow the instructions in the upstream
repository:

```sh
git clone https://github.com/supabase/index_advisor.git
cd index_advisor
sudo make install
```

Once installed, apply the Supabase migrations:

```sh
supabase db reset
```

This will create the required extensions and allow you to call `index_advisor()`
within your Postgres database.
