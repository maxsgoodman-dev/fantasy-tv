# Promoting the first admin

v1 has no UI for role management. After you sign up for the first time, promote
your own account to admin by running this SQL against the Supabase project
(via the SQL editor or the `execute_sql` MCP tool, project_id `wsmegxfnmkhaailxhuih`,
against the `fantasy_tv.profiles` table):

    update fantasy_tv.profiles set role = 'admin' where id = (
      select id from auth.users where email = 'YOUR_EMAIL_HERE'
    );
